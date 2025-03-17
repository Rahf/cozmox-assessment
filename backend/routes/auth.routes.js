const { Router } = require("express");
const querystring = require("querystring");
const axios = require("axios");
const { OAuth2Client } = require("google-auth-library");
const { AppDataSource, User } = require("../db/db");

const router = Router();

const { GOOGLE_CLIENT_ID } = process.env;

router.get("/outlook/login", (req, res) => {
    const outlookAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${querystring.stringify({
        client_id: process.env.OUTLOOK_CLIENT_ID,
        response_type: "code",
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
        response_mode: "query",
        scope: "openid profile email offline_access User.Read",
    })}`;

    res.redirect(outlookAuthUrl);
});

router.get("/outlook/callback", async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: "Authorization code not found" });
        }

        // start oauth flow w/Outlook
        const tokenResponse = await axios.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            querystring.stringify({
                client_id: process.env.OUTLOOK_CLIENT_ID,
                client_secret: process.env.OUTLOOK_CLIENT_SECRET,
                code,
                redirect_uri: process.env.OUTLOOK_REDIRECT_URI,
                grant_type: "authorization_code",
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        const userResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const email = userResponse.data.mail || userResponse.data.userPrincipalName;

        if (!email) {
            return res.status(400).json({ error: "Unable to retrieve email address" });
        }

        let user = await AppDataSource.getRepository(User).findOne({ where: { email } });

        if (!user) {
            user = AppDataSource.getRepository(User).create({
                tenant_id: "hardcoded-tenant",
                email,
                access_token,
                refresh_token,
                token_expiration: new Date(Date.now() + expires_in * 1000),
                provider: "outlook",
            });

            await AppDataSource.getRepository(User).save(user);
        } else {
            user.access_token = access_token;
            user.refresh_token = refresh_token;
            user.token_expiration = new Date(Date.now() + expires_in * 1000);
            await AppDataSource.getRepository(User).save(user);
        }

        res.json({ message: "Outlook OAuth Login Successful", email });
    } catch (error) {
        console.error("Outlook OAuth error:", error.response?.data || error.message);
        res.status(500).json({ error: "Outlook OAuth login failed" });
    }
});

router.post("/google/login", async (req, res) => {
    try {
        const { token } = req.body;

        const client = new OAuth2Client(GOOGLE_CLIENT_ID);

        // start oauth flow with Google
        const clientDetails = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });

        const { email, exp } = clientDetails.getPayload();

        console.log("got payload resp", clientDetails.getPayload());

        let user = await AppDataSource.getRepository(User).findOne({ where: { email } });

        if (!user) {
            user = AppDataSource.getRepository(User).create({
                tenant_id: "hardcoded-tenant",
                email,
                provider: "gmail",
                token_expiration: exp,
            });
            await AppDataSource.getRepository(User).save(user);
        } else {
            user.access_token = token;
            user.token_expiration = new Date(exp * 1000);
            await AppDataSource.getRepository(User).save(user);
        }

        res.json({ message: "OAuth Login Successful", email });
    } catch (error) {
        console.error("OAuth verification error:", error);
        res.status(401).json({ error: "Invalid OAuth token" });
    }
});

module.exports = router;
