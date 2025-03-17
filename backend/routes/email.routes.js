const { Router } = require("express");
const { AppDataSource, User } = require("../db/db");
const { emailQueue } = require("../queue/emailQueue");

const router = Router();

router.post("/send-email", async (req, res) => {
    try {
        const { tenant_id, user_id, address, subject, body } = req.body;

        if (!tenant_id || !user_id || !address || !subject || !body) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const user = await AppDataSource.getRepository(User).findOne({
            where: { id: user_id, tenant_id },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await emailQueue.add("sendEmail", {
            user_id,
            tenant_id,
            address,
            subject,
            body,
            provider: user.provider,
            access_token: user.access_token,
        });

        res.json({ message: "Email queued successfully!" });
    } catch (error) {
        console.error("Error queuing email:", error);
        res.status(500).json({ error: "Error queueing message!" });
    }
});

module.exports = router;
