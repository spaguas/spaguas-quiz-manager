import nodemailer from 'nodemailer';

let transporterPromise;

function createTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_PORT) {
    throw new Error('Configurações SMTP ausentes. Defina SMTP_HOST e SMTP_PORT no .env');
  }

  transporterPromise = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });

  return transporterPromise;
}

export async function sendPasswordResetEmail({ email, token }) {
  const transporter = createTransporter();

  const from = process.env.SMTP_FROM || SMTP_USER || 'no-reply@spaguas.quiz';
  const appUrl = process.env.APP_URL || 'http://localhost:4000';

  const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
    <p>Olá,</p>
    <p>Você solicitou a redefinição de senha para o sistema Spaguas Quiz.</p>
    <p>Utilize o token abaixo ou acesse o link:</p>
    <p><strong>${token}</strong></p>
    <p><a href="${resetUrl}" target="_blank" rel="noreferrer">Redefinir senha</a></p>
    <p>Caso você não tenha solicitado, desconsidere este e-mail.</p>
  `;

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Redefinição de senha - Spaguas Quiz',
    html,
    text: `Token: ${token}\nRedefina sua senha acessando: ${resetUrl}`,
  });
}

export default {
  sendPasswordResetEmail,
};
