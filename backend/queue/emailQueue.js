const Queue = require("bull");
const nodemailer = require("nodemailer");
const { AppDataSource, User } = require("../db/db");
const axios = require("axios");
const redis = require("redis");
const winston = require("winston");

const { REDIS_HOST, REDIS_PORT } = process.env;

const redisClient = redis.createClient({ host: REDIS_HOST, port: REDIS_PORT });
redisClient.connect().then(() => console.log("Redis connected on port", REDIS_PORT));

const emailQueue = new Queue("emailQueue", {
    redis: { host: REDIS_HOST, port: REDIS_PORT },
});

const MAX_EMAILS_PER_DAY = 100;
const QUEUE_EXPIRATION = 86400; // 1 day
const QUEUE_DELAY = 3600000; // 1 hour
const MAX_RETRY_COUNT = 5;

// @todo extract this to separate module
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [new winston.transports.Console(), new winston.transports.File({ filename: "email-log.log" })],
});

const checkAndUpdateQuota = async (userId) => {
    const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const emailQuotaKey = `quota:${userId}:${dateKey}`;

    // Get the current count of emails sent today
    let emailCount = await redisClient.get(emailQuotaKey);
    emailCount = emailCount ? parseInt(emailCount, 10) : 0;

    const maxQuota = MAX_EMAILS_PER_DAY;

    if (emailCount >= maxQuota) {
        return { can_send: false, remaining: 0 };
    }

    // Increment quota count in Redis
    await redisClient.incr(emailQuotaKey);
    await redisClient.expire(emailQuotaKey, QUEUE_EXPIRATION);

    return { can_send: true, remaining: maxQuota - emailCount - 1 };
};

const sendEmail = async (job) => {
    const { tenant_id, user_id, address, subject, body, provider, access_token } = job.data;

    try {
        logger.info(`sending email to user ${user_id} ${tenant_id} ${address}`);

        const user = await AppDataSource.getRepository(User).findOne({ where: { id: user_id, tenant_id: tenant_id } });

        if (!user) {
            logger.error(`User not found: Tenant ${tenant_id}, User ${user_id}`);
            return;
        }

        const quotaCheck = await checkAndUpdateQuota(user_id);
        if (!quotaCheck.can_send) {
            logger.warn(`Quota exceeded for user ${user_id}. Re-queuing email...`);
            await emailQueue.add("sendEmail", job.data, { delay: QUEUE_DELAY });
            return;
        }

        if (await isThrowawayEmail(address)) {
            logger.warn(`Rejected throwaway email: ${address}`);
            return;
        }

        if (provider === "gmail") {
            // @todo handle gmail sender
        } else if (provider === "outlook") {
            // @todo handle outlook sender
        } else {
            logger.error(`Unsupported email provider: ${provider}`);
            return;
        }

        logger.info(`Email successfully sent to ${address}`);
    } catch (error) {
        logger.error(`Error sending email to ${address}: ${error.message}`);

        // handle retries
        const retryCount = job.attemptsMade;
        if (retryCount < MAX_RETRY_COUNT) {
            logger.warn(`Re-queuing email to ${address}, attempt #${retryCount + 1}`);
            await emailQueue.add("sendEmail", job.data, { delay: 60000 * (retryCount + 1) }); // Delay by increasing minutes
        }
    }
};

// @todo find a better provider for checking email `throwaways` :)
const isThrowawayEmail = async (email) => {
    try {
        const domain = email.split("@")[1];
        const response = await axios.get(`https://open.kickbox.com/v1/disposable/${domain}`);
        return response.data.disposable;
    } catch (error) {
        logger.warn("Error checking disposable email", email);
        return null;
    }
};

// ✅ Process Emails in the Queue
emailQueue.process("sendEmail", async (job) => {
    await sendEmail(job);
});

module.exports = { emailQueue };
