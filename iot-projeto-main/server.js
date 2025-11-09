// server.js - Backend completo com Node.js, Express, MongoDB, JWT, Bcrypt e Nodemailer

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const cors = require('cors'); // Para permitir requisições do frontend

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' })); // Ajuste para o seu domínio frontend em produção

// Conexão com MongoDB
mongoose.connect('mongodb://localhost:27017/silo_db', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Erro ao conectar MongoDB:', err));

// Modelo de Usuário
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

// Modelo de Dados do Sensor (exemplo, ajuste conforme necessário)
const SensorDataSchema = new mongoose.Schema({
  field1: Number, // Umidade
  field2: Number, // Temperatura
  created_at: { type: Date, default: Date.now },
});
const SensorData = mongoose.model('SensorData', SensorDataSchema);

// Middleware para verificar JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, 'seu-segredo-jwt'); // Substitua por uma chave secreta forte
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Rota de Registro
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'Campos obrigatórios' });

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ message: 'Usuário ou e-mail já existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar usuário', error: err.message });
  }
});

// Rota de Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Campos obrigatórios' });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Credenciais inválidas' });

    const token = jwt.sign({ id: user._id }, 'seu-segredo-jwt', { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao fazer login', error: err.message });
  }
});

// Rota para Enviar Alerta por E-mail
app.post('/api/auth/send-alert', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Mensagem obrigatória' });

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Ou outro serviço de e-mail
      auth: {
        user: 'seuemail@gmail.com', // Seu e-mail
        pass: 'sua-senha-app', // Senha de app (não a senha normal, para Gmail)
      },
    });

    await transporter.sendMail({
      from: 'Dashboard Silo <seuemail@gmail.com>',
      to: 'admin@exemplo.com', // E-mail do destinatário (pode ser dinâmico do usuário)
      subject: 'Alerta Crítico no Silo',
      text: message,
      html: `<p>${message}</p>`, // Para formato HTML
    });

    res.json({ success: true, message: 'E-mail enviado' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao enviar e-mail', error: err.message });
  }
});

// Rota para Buscar Dados do Sensor (protegida)
app.get('/api/data', authMiddleware, async (req, res) => {
  const { limit = 100, start_date, end_date } = req.query;

  try {
    const query = {};
    if (start_date) query.created_at = { $gte: new Date(start_date) };
    if (end_date) query.created_at = { ...query.created_at, $lte: new Date(end_date) };

    const feeds = await SensorData.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    res.json({ feeds });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados', details: err.message });
  }
});

// Iniciar servidor
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

/* Instruções de Instalação:
1. Instale dependências: npm init -y && npm install express mongoose jsonwebtoken bcrypt nodemailer cors
2. Configure MongoDB local ou cloud (ex: MongoDB Atlas).
3. Substitua 'seu-segredo-jwt' por uma chave segura (use process.env.JWT_SECRET em produção).
4. Configure Nodemailer com credenciais reais (Gmail requer senha de app: https://myaccount.google.com/apppasswords).
5. Para adicionar dados de sensor, crie rotas adicionais se necessário (ex: POST /api/data).
6. Em produção, use HTTPS, dotenv para segredos e rate limiting.
*/