const { Builder, By, until, version } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const proxy = require('selenium-webdriver/proxy');
const axios = require('axios');
const { ProxyAgent } = require('proxy-agent');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to the database'))
    .catch(error => console.error('Database connection error:', error));

// Schema
const TrendSchema = new mongoose.Schema({
    uniqueID: { type: String, required: true },
    trend1: { type: String },
    trend2: { type: String },
    trend3: { type: String },
    trend4: { type: String },
    trend5: { type: String },
    dateTime: { type: Date },
    ipAddress: { type: String },
});

const Trend = mongoose.model('Trend', TrendSchema);

// Function to get a new proxy
const getNewProxy = async () => {
    try {
        return `http://${process.env.PROXYMESH_USERNAME}:${process.env.PROXYMESH_PASSWORD}@gate.proxyMesh.com:31280`;
    } catch (error) {
        console.error("Error getting new proxy:", error);
        return null;
    }
};

// Scraping function
const scrapeTrends = async () => {
    let driver;
    let ipAddress = 'N/A';

    try {
        const proxyUrl = await getNewProxy();
        if (!proxyUrl) {
            throw new Error("Failed to obtain a proxy. Scraping aborted.");
        }

        const options = new chrome.Options()
            .addArguments('--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage')
            .addArguments('--allow-running-insecure-content')
            .addArguments('--ignore-certificate-errors')
            .addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
            .setProxy(proxy.manual({ http: proxyUrl, https: proxyUrl }));


         driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .setChromeService(new chrome.ServiceBuilder('/usr/bin/chromedriver')) // Specify ChromeDriver path
          .build();

        try {
            const axiosConfig = {
                httpsAgent: new ProxyAgent(proxyUrl),
                timeout: 15000,
            };
            const response = await axios.get('http://httpbin.org/ip', axiosConfig);
            ipAddress = response.data.origin.trim();
            console.log(ipAddress)
        } catch (ipError) {
            console.error("Error getting IP address:", ipError);
        }

        await driver.get('https://twitter.com/login');

        try {
            const emailField = await driver.wait(until.elementLocated(By.css('input[name="text"]')), 15000);
            await emailField.sendKeys(process.env.TWITTER_EMAIL);
            const nextButton1 = await driver.wait(until.elementLocated(By.css('button[style*="background-color: rgb(239, 243, 244); border-color: rgba(0, 0, 0, 0);"]')), 10000);
            await nextButton1.click();
            const usernameField = await driver.wait(until.elementLocated(By.css('input[data-testid="ocfEnterTextTextInput"]')), 10000);
            await usernameField.sendKeys(process.env.TWITTER_USERNAME);
            const nextButton2 = await driver.wait(until.elementLocated(By.css('button[data-testid="ocfEnterTextNextButton"]')), 10000);
            await nextButton2.click();
            const passwordField = await driver.wait(until.elementLocated(By.css('input[name="password"]')), 10000);
            await passwordField.sendKeys(process.env.TWITTER_PASSWORD);
            const loginButton = await driver.wait(until.elementLocated(By.css('button[data-testid="LoginForm_Login_Button"]')), 10000);
            await loginButton.click();
        } catch (loginError) {
            console.error("Login Error:", loginError);
            throw loginError; // Re-throw to stop scraping
        }

        await driver.wait(until.urlContains('home'), 20000);
        await driver.get('https://x.com/explore/tabs/for_you');
        await driver.wait(until.elementLocated(By.css('div[data-testid="trend"]')), 15000);
        const trendElements = await driver.findElements(By.css('div[data-testid="trend"]'));

        const trends = [];
        for (const trendElement of trendElements.slice(0,5)) {
            const category = await trendElement.findElement(By.css('div[class*="r-1wbh5a2"]')).getText().catch(() => 'N/A');
            const topic = await trendElement.findElement(By.css('div[class*="r-1bymd8e"]')).getText().catch(() => 'N/A');
            const posts = await trendElement.findElement(By.css('div[class*="r-14gqq1x"]')).getText().catch(() => 'N/A');
            trends.push({ category, topic, posts });
        }

        const now = new Date();
        const trendData = {
            uniqueID: uuidv4(),
            trends,
            dateTime: now,
            ipAddress: ipAddress,
        };
        return trendData;
    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    } finally {
        if (driver) {
            await driver.quit();
        }
    }
};


// API Endpoint to trigger scraping
app.post('/run-script', async (req, res) => {
    try {
        const data = await scrapeTrends();
        const newTrend = new Trend(data);
        await newTrend.save();
        res.status(200).json({ message: "Scraping completed and data saved.", data });
    } catch (error) {
        console.error("Scraping process error:", error);
        res.status(500).json({ error: "Scraping failed." });
    }
});

app.get('/',async(req,res)=>{
    res.status(200).json({message:"welcome to the world"})
})

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
