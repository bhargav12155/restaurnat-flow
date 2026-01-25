import nodemailer from "nodemailer";

// Email configuration
const createTransporter = () => {
  // Check if SMTP settings are configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Fallback: Log emails to console in development
  console.log("📧 SMTP not configured - emails will be logged to console");
  return null;
};

const transporter = createTransporter();

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, text } = options;
  
  if (!transporter) {
    // Log email content for development/testing
    console.log("\n📧 ====== EMAIL (SMTP not configured) ======");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML Content:\n${html}`);
    console.log("📧 ==========================================\n");
    return true; // Return success for development
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    return false;
  }
}

// Generate a random verification token
export function generateVerificationToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Send verification email
export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string
): Promise<boolean> {
  const baseUrl = process.env.APP_URL || "http://localhost:5001";
  const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - RestaurantFlow</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td>
            <div style="background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🍽️ RestaurantFlow</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Restaurant Marketing Platform</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px;">
                <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 24px;">Welcome, ${name}! 👋</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  Thank you for signing up for RestaurantFlow! To get started, please verify your email address by clicking the button below.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #dc2626); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Verify My Email
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                  Or copy and paste this link into your browser:<br>
                  <a href="${verificationLink}" style="color: #f97316; word-break: break-all;">${verificationLink}</a>
                </p>
                
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This link will expire in 24 hours. If you didn't create an account with RestaurantFlow, you can safely ignore this email.
                  </p>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 24px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} RestaurantFlow. All rights reserved.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "🍽️ Verify your RestaurantFlow account",
    html,
  });
}

// Send welcome email after verification
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const baseUrl = process.env.APP_URL || "http://localhost:5001";
  const loginLink = `${baseUrl}/login`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to RestaurantFlow!</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td>
            <div style="background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to RestaurantFlow!</h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px;">
                <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 24px;">Your account is verified! ✅</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  Hi ${name}, your email has been verified and your account is now active. You're ready to start creating amazing marketing content for your restaurant!
                </p>
                
                <h3 style="color: #1f2937; margin: 24px 0 12px; font-size: 18px;">What you can do:</h3>
                <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
                  <li>Generate AI-powered social media content</li>
                  <li>Create video avatars for your restaurant</li>
                  <li>Schedule posts across multiple platforms</li>
                  <li>Optimize your SEO presence</li>
                  <li>Manage your menu items and specials</li>
                </ul>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${loginLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #dc2626); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Go to Dashboard
                  </a>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 24px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} RestaurantFlow. All rights reserved.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "🎉 Welcome to RestaurantFlow - Your account is ready!",
    html,
  });
}

// Send password reset email (for future use)
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<boolean> {
  const baseUrl = process.env.APP_URL || "http://localhost:5001";
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - MarketingFlow</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td>
            <div style="background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #f97316, #dc2626); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px;">
                <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 24px;">Hi ${name},</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  We received a request to reset your password. Click the button below to create a new password.
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #dc2626); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Reset Password
                  </a>
                </div>
                
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "🔐 Reset your RestaurantFlow password",
    html,
  });
}
