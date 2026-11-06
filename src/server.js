const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const DATA_FILE = path.join(__dirname, 'data/cadastrados.json');
const LIMIT_CADASTROS = 400;

function readData() {
  if (!fs.existsSync(DATA_FILE)) return { cadastrados: [], config: { travadoManual: false } };
  try {
    const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(fileData);
    if (Array.isArray(parsed)) {
      return { cadastrados: parsed, config: { travadoManual: false } };
    }
    return { 
      cadastrados: parsed.cadastrados || [], 
      config: parsed.config || { travadoManual: false } 
    };
  } catch (e) { return { cadastrados: [], config: { travadoManual: false } }; }
}

function writeData(cadastrados, config) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const currentData = readData();
  const finalConfig = config !== undefined ? config : currentData.config;
  fs.writeFileSync(DATA_FILE, JSON.stringify({ cadastrados, config: finalConfig }, null, 2));
}

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

app.get('/', (req, res) => {
  const { cadastrados, config } = readData();
  const total = cadastrados.length;
  const lotado = total >= LIMIT_CADASTROS || config.travadoManual;
  const motivoBloqueio = config.travadoManual ? 'manutencao' : (total >= LIMIT_CADASTROS ? 'limite' : null);
  const sucesso = req.query.sucesso === 'true';

  res.render('index', { total, lotado, motivoBloqueio, limit: LIMIT_CADASTROS, sucesso });
});

app.post('/cadastrar', (req, res) => {
  const { cadastrados, config } = readData();
  if (cadastrados.length >= LIMIT_CADASTROS || config.travadoManual) {
    return res.redirect('/?erro=limite_atingido');
  }

  const { nome, nascimento, email, telefone, pais, cep, endereco, complemento, bairro, cidade, estado } = req.body;

  cadastrados.push({
    id: Date.now().toString(),
    nome, 
    nascimento,
    email, 
    telefone,
    pais: pais || 'Brasil', 
    cep, 
    endereco,
    complemento: complemento || '', 
    bairro, 
    cidade, 
    estado, 
    enviado: false,
    dataCadastro: new Date().toISOString()
  });

  writeData(cadastrados);
  res.redirect('/?sucesso=true');
});

// ==========================================
// ROTAS DE ADMINISTRAÇÃO
// ==========================================

app.get('/admin/login', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/admin/login', (req, res) => {
  const { usuario, senha } = req.body;
  const validos = [
    { user: 'leoncio', pass: 'leoncio#123#' },
    { user: 'carioca', pass: 'carioca#123#' },
    { user: 'admin', pass: 'admin#123#' }
  ];
  const valido = validos.find(u => u.user === usuario && u.pass === senha);
  if (valido) {
    res.redirect(`/admin/painel?user=${usuario}`);
  } else {
    res.render('login', { erro: 'Utilizador ou palavra-passe inválidos!' });
  }
});

app.get('/admin/painel', (req, res) => {
  const user = req.query.user;
  if (!user) return res.redirect('/admin/login');

  const { cadastrados, config } = readData();
  cadastrados.sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

  res.render('admin', { cadastrados, config, user });
});

app.post('/admin/toggle-trava', (req, res) => {
  const { cadastrados, config } = readData();
  config.travadoManual = !config.travadoManual;
  writeData(cadastrados, config);
  res.json({ success: true, travadoManual: config.travadoManual });
});

app.post('/admin/excluir/:id', (req, res) => {
  const { id } = req.params;
  const { cadastrados, config } = readData();
  const novosCadastrados = cadastrados.filter(item => item.id !== id);
  writeData(novosCadastrados, config);
  res.json({ success: true });
});

app.post('/admin/editar/:id', (req, res) => {
  const { id } = req.params;
  const { nome, nascimento, email, telefone, pais, cep, endereco, complemento, bairro, cidade, estado } = req.body;
  
  const { cadastrados, config } = readData();
  const novosCadastrados = cadastrados.map(item => {
    if (item.id === id) {
      item.nome = nome;
      item.nascimento = nascimento;
      item.email = email;
      item.telefone = telefone;
      item.pais = pais;
      item.cep = cep;
      item.endereco = endereco;
      item.complemento = complemento;
      item.bairro = bairro;
      item.cidade = cidade;
      item.estado = estado;
    }
    return item;
  });

  writeData(novosCadastrados, config);
  res.redirect(`/admin/painel?user=admin`);
});

app.post('/admin/acao-massa', (req, res) => {
  const { ids, acao } = req.body;
  if (!ids || !Array.isArray(ids)) return res.json({ success: false });

  const { cadastrados, config } = readData();
  const statusDesejado = acao === 'enviado';

  const novosCadastrados = cadastrados.map(item => {
    if (ids.includes(item.id)) {
      item.enviado = statusDesejado;
    }
    return item;
  });

  writeData(novosCadastrados, config);
  res.json({ success: true });
});

app.get('/admin/exportar-csv', (req, res) => {
  const { cadastrados } = readData();
  let csvContent = 'ID;Data Cadastro;Nome Completo;Data Nascimento;E-mail;Telefone;País;CEP/ZIP;Endereço;Complemento;Bairro;Cidade;Estado;Status Envio\n';

  cadastrados.forEach(item => {
    const dataFormatada = new Date(item.dataCadastro).toLocaleDateString('pt-BR');
    const status = item.enviado ? 'Enviado' : 'Não Enviado';
    const linha = [
      item.id, dataFormatada,
      `"${(item.nome || '').replace(/"/g, '""')}"`,
      `"${(item.nascimento || '').replace(/"/g, '""')}"`,
      `"${(item.email || '').replace(/"/g, '""')}"`,
      `"${(item.telefone || '').replace(/"/g, '""')}"`,
      `"${(item.pais || 'Brasil').replace(/"/g, '""')}"`,
      `"${(item.cep || '').replace(/"/g, '""')}"`,
      `"${(item.endereco || '').replace(/"/g, '""')}"`,
      `"${(item.complemento || '').replace(/"/g, '""')}"`,
      `"${(item.bairro || '').replace(/"/g, '""')}"`,
      `"${(item.cidade || '').replace(/"/g, '""')}"`,
      `"${(item.estado || '').replace(/"/g, '""')}"`,
      status
    ].join(';');
    csvContent += linha + '\n';
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=cadastrados_chat_garage.csv');
  res.send('\uFEFF' + csvContent);
});

app.post('/admin/toggle-status/:id', (req, res) => {
  const { cadastrados, config } = readData();
  const novosCadastrados = cadastrados.map(item => {
    if (item.id === req.params.id) item.enviado = !item.enviado;
    return item;
  });
  writeData(novosCadastrados, config);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Chat Garage rodando em http://localhost:${PORT}`));