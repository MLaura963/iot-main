from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuração do MongoDB Atlas
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')
COLLECTION_NAME = os.getenv('COLLECTION_NAME')

print("Tentando conectar ao MongoDB...")
print(f"Database: {DB_NAME}")
print(f"Collection: {COLLECTION_NAME}")

# Inicializar variáveis
client = None
db = None
collection = None

try:
    client = MongoClient(MONGO_URI)
    
    # Testar a conexão
    client.admin.command('ping')
    print("Conectado ao MongoDB Atlas com sucesso!")
    
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Verificar se a collection existe e tem dados
    count = collection.count_documents({})
    print(f"Total de documentos na collection: {count}")
    
except Exception as e:
    print(f"Erro ao conectar com MongoDB: {e}")
    print(f"Verifique se:")
    print(f"   - Suas credenciais estao corretas")
    print(f"   - O IP esta na whitelist do MongoDB Atlas")
    print(f"   - A database e collection existem")

@app.route('/api/data', methods=['GET'])
def get_sensor_data():
    if collection is None:
        return jsonify({'error': 'Conexao com MongoDB nao estabelecida'}), 500
    
    try:
        limit = int(request.args.get('limit', 100))
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        print(f"Buscando {limit} registros do MongoDB...")
        
        # Construir query base
        query = {}
        
        # Adicionar filtro de data se fornecido
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter['$gte'] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            if end_date:
                date_filter['$lte'] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query['created_at'] = date_filter
        
        # Buscar dados do MongoDB - ordenados pelos mais recentes
        feeds = list(collection.find(
            query, 
            {'_id': 0, 'field1': 1, 'field2': 1, 'created_at': 1}
        ).sort('created_at', -1).limit(limit))
        
        print(f"Encontrados {len(feeds)} registros")
        
        # Formatar dados - reverter para ordem cronológica
        formatted_feeds = []
        for feed in reversed(feeds):
            formatted_feed = {
                'field1': feed.get('field1'),
                'field2': feed.get('field2'),
                'created_at': feed.get('created_at')
            }
            formatted_feeds.append(formatted_feed)
        
        # Estatísticas dos dados
        valid_feeds = [f for f in formatted_feeds if f['field1'] is not None and f['field2'] is not None]
        print(f"Dados validos: {len(valid_feeds)}/{len(formatted_feeds)}")
        
        return jsonify({
            'feeds': formatted_feeds,
            'channel': {
                'id': 'mongodb_channel',
                'name': 'MongoDB Sensor Data'
            },
            'stats': {
                'total': len(formatted_feeds),
                'valid': len(valid_feeds),
                'filters_applied': {
                    'limit': limit,
                    'start_date': start_date,
                    'end_date': end_date
                }
            }
        })
        
    except Exception as e:
        print(f"Erro ao buscar dados: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        if client is not None and collection is not None:
            client.admin.command('ping')
            count = collection.count_documents({})
            return jsonify({
                'status': 'healthy', 
                'database': 'connected',
                'total_records': count
            })
        else:
            return jsonify({'status': 'error', 'database': 'disconnected'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'database': 'disconnected', 'error': str(e)}), 500

@app.route('/api/test', methods=['GET'])
def test_connection():
    """Rota para testar a conexao e estrutura dos dados"""
    try:
        if collection is None:
            return jsonify({'error': 'Collection nao disponivel'}), 500
            
        # Buscar um documento de exemplo para ver a estrutura
        sample = collection.find_one({}, {'_id': 0})
        
        # Contar documentos por campo
        total = collection.count_documents({})
        with_field1 = collection.count_documents({'field1': {'$exists': True, '$ne': None}})
        with_field2 = collection.count_documents({'field2': {'$exists': True, '$ne': None}})
        
        # Buscar datas mínima e máxima
        oldest = collection.find_one({}, {'created_at': 1}, sort=[('created_at', 1)])
        newest = collection.find_one({}, {'created_at': 1}, sort=[('created_at', -1)])
        
        return jsonify({
            'sample_document': sample,
            'counts': {
                'total': total,
                'with_field1': with_field1,
                'with_field2': with_field2
            },
            'date_range': {
                'oldest': oldest.get('created_at') if oldest else None,
                'newest': newest.get('created_at') if newest else None
            },
            'connection_info': {
                'database': DB_NAME,
                'collection': COLLECTION_NAME
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_detailed_stats():
    """Rota para estatísticas detalhadas"""
    try:
        if collection is None:
            return jsonify({'error': 'Collection nao disponivel'}), 500
            
        # Estatísticas básicas
        total = collection.count_documents({})
        
        # Estatísticas de campos
        stats = {
            'total_records': total,
            'records_with_field1': collection.count_documents({'field1': {'$exists': True, '$ne': None}}),
            'records_with_field2': collection.count_documents({'field2': {'$exists': True, '$ne': None}}),
            'records_with_both_fields': collection.count_documents({
                'field1': {'$exists': True, '$ne': None},
                'field2': {'$exists': True, '$ne': None}
            })
        }
        
        # Estatísticas numéricas se houver dados
        if stats['records_with_field1'] > 0:
            pipeline = [
                {'$match': {'field1': {'$exists': True, '$ne': None}}},
                {'$group': {
                    '_id': None,
                    'avg': {'$avg': '$field1'},
                    'min': {'$min': '$field1'},
                    'max': {'$max': '$field1'},
                    'count': {'$sum': 1}
                }}
            ]
            field1_stats = list(collection.aggregate(pipeline))
            if field1_stats:
                stats['field1'] = field1_stats[0]
        
        if stats['records_with_field2'] > 0:
            pipeline = [
                {'$match': {'field2': {'$exists': True, '$ne': None}}},
                {'$group': {
                    '_id': None,
                    'avg': {'$avg': '$field2'},
                    'min': {'$min': '$field2'},
                    'max': {'$max': '$field2'},
                    'count': {'$sum': 1}
                }}
            ]
            field2_stats = list(collection.aggregate(pipeline))
            if field2_stats:
                stats['field2'] = field2_stats[0]
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "="*50)
    print("Iniciando Servidor Flask")
    print("="*50)
    print("API MongoDB Dashboard")
    print(f"URL: http://localhost:5000")
    print(f"Dados: http://localhost:5000/api/data")
    print(f"Health: http://localhost:5000/api/health")
    print(f"Teste: http://localhost:5000/api/test")
    print(f"Estatísticas: http://localhost:5000/api/stats")
    print("="*50)
    app.run(debug=True, port=5000)
