const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const transporter = require("../config/mailer");

const sendWelcomeEmail = async (email, name) => {
  const source = fs.readFileSync(
    path.join(__dirname, "../emails/templates/welcome.hbs"),
    "utf8"
  );

  const template = handlebars.compile(source);
  const html = template({
    name,
    dashboardUrl: process.env.FRONTEND_URL,
    year: new Date().getFullYear(),
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Welcome to URL Shortener",
    html,
  });
};

module.exports = { sendWelcomeEmail };
