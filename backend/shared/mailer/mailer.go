package mailer

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"github.com/resend/resend-go/v2"

	"github.com/akhilbabu26/jinnx/shared/config"
)

type Mailer struct {
	client    *resend.Client
	fromEmail string

	smtpHost string
	smtpPort string
	smtpUser string
	smtpPass string
	smtpFrom string
	useSMTP  bool
}

func NewMailer(cfg *config.Config) *Mailer {
	if cfg.SMTPHost != "" {
		return &Mailer{
			smtpHost: cfg.SMTPHost,
			smtpPort: cfg.SMTPPort,
			smtpUser: cfg.SMTPUser,
			smtpPass: cfg.SMTPPass,
			smtpFrom: cfg.SMTPFrom,
			useSMTP:  true,
		}
	}

	return &Mailer{
		client:    resend.NewClient(cfg.ResendAPIKey),
		fromEmail: cfg.EmailFrom,
		useSMTP:   false,
	}
}

func generateMessageID(fromEmail string) string {
	parts := strings.Split(fromEmail, "@")
	domain := "localhost"
	if len(parts) > 1 {
		domain = parts[1]
	}
	t := time.Now().UnixNano()
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("<%d.%x@%s>", t, b, domain)
}

func buildHTMLTemplate(title, contentHTML string) string {
	tmpl := `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>{{TITLE}}</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			background-color: #f3f4f6;
			color: #1f2937;
			margin: 0;
			padding: 0;
			-webkit-font-smoothing: antialiased;
		}
		.container {
			max-width: 600px;
			margin: 40px auto;
			background-color: #ffffff;
			border-radius: 12px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
			overflow: hidden;
			border: 1px solid #e5e7eb;
		}
		.header {
			background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
			padding: 30px 20px;
			text-align: center;
			border-bottom: 3px solid #6366f1;
		}
		.logo {
			font-size: 24px;
			font-weight: 800;
			letter-spacing: 1px;
			color: #ffffff;
			margin: 0;
			text-transform: uppercase;
		}
		.logo span {
			color: #6366f1;
		}
		.content {
			padding: 40px 30px;
			line-height: 1.6;
			font-size: 16px;
		}
		.footer {
			background-color: #f9fafb;
			padding: 24px 30px;
			text-align: center;
			font-size: 13px;
			color: #6b7280;
			border-top: 1px solid #e5e7eb;
		}
		.footer p {
			margin: 4px 0;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1 class="logo">JINNX<span>FIT</span></h1>
		</div>
		<div class="content">
			{{CONTENT}}
		</div>
		<div class="footer">
			<p>&copy; 2026 Jinnx Fit. All rights reserved.</p>
			<p>This is an automated notification. Please do not reply directly to this email.</p>
		</div>
	</div>
</body>
</html>`

	tmpl = strings.Replace(tmpl, "{{TITLE}}", title, 1)
	tmpl = strings.Replace(tmpl, "{{CONTENT}}", contentHTML, 1)
	return tmpl
}

func (m *Mailer) send(ctx context.Context, toEmail, subject, htmlBody string) error {
	if m.useSMTP {
		msgID := generateMessageID(m.smtpFrom)
		msg := []byte("To: " + toEmail + "\r\n" +
			"From: \"Jinnx Fit\" <" + m.smtpFrom + ">\r\n" +
			"Subject: " + subject + "\r\n" +
			"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n" +
			"Message-ID: " + msgID + "\r\n" +
			"MIME-Version: 1.0\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: 8bit\r\n" +
			"\r\n" +
			htmlBody + "\r\n")

		auth := smtp.PlainAuth("", m.smtpUser, m.smtpPass, m.smtpHost)
		addr := fmt.Sprintf("%s:%s", m.smtpHost, m.smtpPort)
		return smtp.SendMail(addr, auth, m.smtpFrom, []string{toEmail}, msg)
	}

	_, err := m.client.Emails.Send(&resend.SendEmailRequest{
		From:    m.fromEmail,
		To:      []string{toEmail},
		Subject: subject,
		Html:    htmlBody,
	})
	return err
}

func (m *Mailer) SendOTP(ctx context.Context, email, code string) error {
	body := fmt.Sprintf(`
		<h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Email Verification</h2>
		<p style="margin-bottom: 24px; color: #374151;">Your verification OTP code is below. Please enter this code in the application to complete your process.</p>
		<div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 30px 0; border: 1px dashed #cbd5e1;">
			<h1 style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; letter-spacing: 8px; color: #4f46e5; margin: 0; padding-left: 8px;">%s</h1>
		</div>
		<p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">This code expires in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
	`, code)
	return m.send(ctx, email, "Your verification code", buildHTMLTemplate("Email Verification", body))
}

func (m *Mailer) SendApprovalNotification(ctx context.Context, email, name string) error {
	body := fmt.Sprintf(`
		<h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Welcome, %s!</h2>
		<p style="margin-bottom: 16px; color: #374151;">Your registration has been <strong>approved</strong> by your trainer.</p>
		<p style="margin-bottom: 24px; color: #374151;">You can now log in and start your fitness journey.</p>
	`, name)
	return m.send(ctx, email, "Your registration has been approved!", buildHTMLTemplate("Registration Approved", body))
}

func (m *Mailer) SendRejectionNotification(ctx context.Context, email, name string) error {
	body := fmt.Sprintf(`
		<h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">Hi %s,</h2>
		<p style="margin-bottom: 16px; color: #374151;">Unfortunately, your registration could not be approved at this time.</p>
		<p style="margin-bottom: 24px; color: #374151;">Please contact your trainer directly for more information.</p>
	`, name)
	return m.send(ctx, email, "Update on your registration", buildHTMLTemplate("Registration Update", body))
}

func (m *Mailer) SendAdminNotification(ctx context.Context, userName, userEmail string) error {
	body := fmt.Sprintf(`
		<h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px;">New User Registration</h2>
		<p style="margin-bottom: 16px; color: #374151;">A new user, <strong>%s</strong> (%s), has verified their email address and is waiting for your approval.</p>
		<p style="margin-bottom: 24px; color: #374151;">Please log in to the admin panel to review and approve or reject this registration.</p>
	`, userName, userEmail)

	target := m.fromEmail
	if m.useSMTP {
		target = m.smtpFrom
	}
	return m.send(ctx, target, "New registration pending approval", buildHTMLTemplate("New User Waiting Approval", body))
}
