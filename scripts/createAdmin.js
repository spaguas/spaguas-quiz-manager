#!/usr/bin/env node
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach((arg) => {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return;
    }

    const [key, value] = arg.split('=');
    if (!value) {
      return;
    }

    switch (key) {
      case '--name':
        options.name = value;
        break;
      case '--email':
        options.email = value;
        break;
      case '--password':
        options.password = value;
        break;
      default:
        break;
    }
  });

  return options;
}

function printUsage() {
  stdout.write(`Cria ou promove um usuário administrador.

Uso:
  npm run create:admin -- --name="Nome" --email="email@dominio" --password="senha"

Opções:
  --name       Nome completo do usuário (obrigatório se não informado interativamente)
  --email      E-mail único do usuário (obrigatório)
  --password   Senha do usuário. Se omitida, será solicitada interativamente.
  -h, --help   Mostra esta ajuda.

Variáveis de ambiente alternativas:
  ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
`);
}

async function askMissing(field, currentValue, options = {}) {
  if (currentValue) {
    return currentValue;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${options.prompt ?? `Informe ${field}`}: `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printUsage();
    return;
  }

  const name = await askMissing(
    'o nome',
    args.name || process.env.ADMIN_NAME,
    { prompt: 'Nome do administrador' },
  );
  const email = await askMissing(
    'o e-mail',
    args.email || process.env.ADMIN_EMAIL,
    { prompt: 'E-mail do administrador' },
  );
  let password = args.password || process.env.ADMIN_PASSWORD;

  if (!password) {
    password = await askMissing(
      'a senha',
      password,
      { prompt: 'Senha do administrador (será exibida na tela)' },
    );
  }

  if (!name || !email || !password) {
    throw new Error('Nome, e-mail e senha são obrigatórios.');
  }

  const emailLower = email.toLowerCase();
  const passwordHash = await hashPassword(password);

  const existingUser = await prisma.user.findUnique({
    where: { email: emailLower },
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        passwordHash,
        role: 'ADMIN',
      },
    });

    stdout.write(
      `Usuário existente atualizado com sucesso.\n` +
      `ID: ${updated.id}\n` +
      `Nome: ${updated.name}\n` +
      `E-mail: ${updated.email}\n` +
      `Perfil: ${updated.role}\n`,
    );
    return;
  }

  const adminUser = await prisma.user.create({
    data: {
      name,
      email: emailLower,
      passwordHash,
      role: 'ADMIN',
    },
  });

  stdout.write(
    `Usuário administrador criado com sucesso.\n` +
    `ID: ${adminUser.id}\n` +
    `Nome: ${adminUser.name}\n` +
    `E-mail: ${adminUser.email}\n` +
    `Perfil: ${adminUser.role}\n`,
  );
}

main()
  .catch((error) => {
    console.error('Erro ao criar administrador:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
