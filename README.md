🌍 Lumina Tour
Lumina Tour is an interactive, AI-driven web application that transforms your device into a personal tour guide. Using advanced computer vision and Google’s Gemini models, it identifies landmarks in real-time, providing historical context, immersive audio guides, and smart recognition.

✨ Features
🔍 Smart Identification: Instantly recognizes global landmarks. If the subject isn't a famous site, the AI intelligently identifies it as a "thing" (e.g., a room poster or common object) to ensure accuracy.

🎙️ Smart Audio Guide: Listen to the history of your discoveries with a seamless pause-and-resume feature that remembers exactly where you left off.

📸 High-Precision Image Search: Powered by gemini-3.1-flash-image-preview and Google Search, the app fetches up to 8 high-quality, real-world images for every landmark.

📜 Historical Timelines: Dive deep into the past with curated timelines and fun facts specifically generated for identified locations.

📱 Seamless AR Interface: A refined, mobile-friendly UI featuring a robust camera preview and zero-overlap design for an uninterrupted exploration experience.

📂 Discovery History: Keep track of your travels and findings with a built-in session history.

🛠️ Tech Stack
Frontend: React, TypeScript, Vite

AI Engine: Google Gemini API (Flash 2.0 & 3.1 Preview)

Styling: Tailwind CSS, Lucide Icons

State Management: React Hooks (Camera API & Audio State)

🚀 Getting Started
1. Prerequisites
Node.js installed.

A Google Gemini API Key. Get one at Google AI Studio.

2. Installation
Bash
# Clone the repository
git clone https://github.com/Krish-x90/Lumina-Tour.git

# Navigate to the project folder
cd Lumina-Tour

# Install dependencies
npm install
3. Environment Setup
Create a .env file in the root directory and add your API key:

Code snippet
VITE_GEMINI_API_KEY=your_api_key_here
4. Run the App
Bash
npm run dev
🔒 Privacy & Security
This project uses environment variables to handle API keys. Never commit your .env file to GitHub. A .env.example file is provided to show the required structure without revealing sensitive data.

👤 Author
Krish Sarode

GitHub: @Krish-x90

© 2026 Krish Sarode. All Rights Reserved.
