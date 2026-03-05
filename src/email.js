const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const testAccount = await nodemailer.createTestAccount();
  console.log('Ethereal email account created:', testAccount.user);

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return transporter;
}

async function sendVerificationEmail(toEmail, token, baseUrl) {
  const transport = await getTransporter();
  const verifyUrl = `${baseUrl}/verify.html?token=${token}`;

  const info = await transport.sendMail({
    from: '"Polaris One" <noreply@polaris.one>',
    to: toEmail,
    subject: 'Verify your email — Polaris One',
    text: `Welcome to Polaris One!\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #001E3A;">Welcome to Polaris One!</h2>
        <p style="color: #6B7280;">Please verify your email address by clicking the button below.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #FE4B60; color: white; text-decoration: none; border-radius: 50px; font-weight: 600; margin: 20px 0;">Verify Email</a>
        <p style="color: #6B7280; font-size: 13px;">This link expires in 24 hours.</p>
      </div>
    `,
  });

  console.log('Verification email sent. Preview URL:', nodemailer.getTestMessageUrl(info));
  return info;
}

module.exports = { sendVerificationEmail };
