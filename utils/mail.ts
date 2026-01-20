import Mailgun from "mailgun.js";

export const sentMailService = async (recipients: string[], subject: string, html: string, from?: string) => {
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
        username: "api",
        key: process.env.MAILGUN_APIKEY || "",
        url: process.env.MAILGUN_BASE_URL || "https://api.mailgun.net",
    });

    if (!from) {
        from = "UniComm <unicomm@" + (process.env.MAILGUN_DOMAIN || "") + ">";
    }

    const data = await mg.messages.create(process.env.MAILGUN_DOMAIN || "", {
        from,
        to: recipients,
        subject,
        html,
    });
    return data;
}