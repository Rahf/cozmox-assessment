import axios from "axios";
import React, { useState } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

import "./App.css";

// @todo store these in an env
const API_URL = "http://localhost:3000";
const GOOGLE_CLIENT_ID = "598840726120-0mn75b3msmpsmc7opk05spaf5du2ims0.apps.googleusercontent.com";

const App = () => {
    const [message, setMessage] = useState("");

    const handleGoogleOAuthSuccess = async (response) => {
        try {
            const { credential } = response;
            const tokenResponse = await axios.post(`${API_URL}/auth/google/login`, { token: credential });
            setMessage(tokenResponse.data.message);
        } catch (error) {
            setMessage(error.response?.data?.error || "OAuth login failed");
        }
    };

    const handleMicrosoftOAuth = () => {
        window.location.href = `${API_URL}/auth/outlook/login`;
    };

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                    <h2 className="text-xl font-semibold mb-4">Link Email Account</h2>
                    {message && <p className="mb-4 text-center text-sm text-green-600">{message}</p>}
                    <div className="w-full flex flex-col gap-4">
                        <GoogleLogin onSuccess={handleGoogleOAuthSuccess} onError={() => setMessage("Google OAuth failed")} />
                        <button className="bg-blue-500 text-white p-2 rounded w-full" onClick={handleMicrosoftOAuth}>
                            Login with Outlook
                        </button>
                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
};

export default App;
