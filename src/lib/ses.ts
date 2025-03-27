import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Interface for email template data
interface EmailTemplateData {
  [key: string]: string | number | boolean;
}

// Email template definitions
interface EmailTemplate {
  subject: string;
  html: (data: EmailTemplateData) => string;
}

// Collection of email templates
const emailTemplates: Record<string, EmailTemplate> = {
  invite: {
    subject: "Your Invitation to CT Session Tracker",
    html: (data) => `
      <h1>Welcome to CT Session Tracker!</h1>
      <p>You have been invited to join CT Session Tracker. To complete your registration, please use the following invite code:</p>
      <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 18px; text-align: center;">
        ${data.inviteCode}
      </div>
      <p>Click <a href="${process.env.NEXTAUTH_URL}/register">here</a> to register your account.</p>
      <p>This invite code will expire in 7 days.</p>
      <p>If you did not request this invitation, please ignore this email.</p>
    `,
  },
  // Add more email templates here as needed
  // Example:
  // passwordReset: {
  //   subject: "Password Reset Request",
  //   html: (data) => `
  //     <h1>Password Reset Request</h1>
  //     <p>Click the link below to reset your password:</p>
  //     <p><a href="${data.resetLink}">Reset Password</a></p>
  //     <p>This link will expire in 1 hour.</p>
  //   `,
  // },
};

export async function sendTemplatedEmail(
  templateName: keyof typeof emailTemplates,
  toEmail: string,
  templateData: EmailTemplateData,
  options: Partial<SendEmailCommandInput> = {}
): Promise<boolean> {
  const template = emailTemplates[templateName];
  if (!template) {
    console.error(`Email template '${templateName}' not found`);
    return false;
  }

  const params: SendEmailCommandInput = {
    Source: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Data: template.subject,
      },
      Body: {
        Html: {
          Data: template.html(templateData),
        },
      },
    },
    ...options,
  };

  try {
    await ses.send(new SendEmailCommand(params));
    return true;
  } catch (error) {
    console.error(`Error sending ${templateName} email:`, error);
    return false;
  }
}

// Convenience function for sending invite emails (maintains backward compatibility)
export async function sendInviteEmail(
  toEmail: string,
  inviteCode: string
): Promise<boolean> {
  return sendTemplatedEmail("invite", toEmail, { inviteCode });
}
