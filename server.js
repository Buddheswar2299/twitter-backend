const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { Builder, By, until } = require('selenium-webdriver');
const { v4: uuidv4 } = require('uuid');
const chrome = require('selenium-webdriver/chrome');

dotenv.config();
const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

const connectdb = mongoose.connection;
connectdb.once('open', () => {
  console.log('Successfully connected to the database');
});

connectdb.on('error', (error) => {
  console.error('Database connection error:', error);
});

// Schema
const TrendSchema = new mongoose.Schema({
  uniqueID: {
    type: String,
    required: true,
  },
  trends: [
    {
      rank: {
        type: String,
        required: false,
      },
      category: {
        type: String,
        required: true,
      },
      topic: {
        type: String,
        required: true,
      },
      posts: {
        type: String,
        required: false, // Optional since not all trends may show post counts
      },
    },
  ],
  dateTime: {
    type: String,
    required: true,
  },
});

const Trend = mongoose.model('Trend', TrendSchema);

// Scraping Function
const scrapeTrends = async () => {
  const options = new chrome.Options();

  options.addArguments('--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage');
  options.addArguments('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  options.addArguments('--allow-running-insecure-content');
  options.addArguments('--ignore-certificate-errors');

  const driver = new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    await driver.get('https://twitter.com/login');

    // Wait for the email field and input the email
    await driver.wait(until.elementLocated(By.css('input[name="text"]')), 15000);
    await driver.findElement(By.css('input[name="text"]')).sendKeys(process.env.TWITTER_EMAIL)

    //click the button
    await driver.findElement(By.css('button[style*="background-color: rgb(239, 243, 244); border-color: rgba(0, 0, 0, 0);"]')).click();
    

    // // Input username after email
    await driver.wait(until.elementLocated(By.css('input[data-testid="ocfEnterTextTextInput"]')), 10000);
    await driver.findElement(By.css('input[name="text"]')).sendKeys(process.env.TWITTER_USERNAME)

    await driver.findElement(By.css('button[data-testid="ocfEnterTextNextButton"]')).click();

    // Input password
    await driver.wait(until.elementLocated(By.css('input[name="password"]')), 10000);
    await driver.findElement(By.css('input[name="password"]')).sendKeys(process.env.TWITTER_PASSWORD)
    
    try{
        await driver.findElement(By.css('button[data-testid="LoginForm_Login_Button"]')).click();
    }catch{
        console.log('error in password click')
    }
   

    // Wait for the home page to load
    await driver.wait(until.urlContains('home'), 20000);

    // Navigate to the Trending page
    await driver.get('https://x.com/explore/tabs/for_you');

    // Wait for the trends to load
    await driver.wait(until.elementLocated(By.css('div[data-testid="trend"]')), 15000);
    const trendElements = await driver.findElements(By.css('div[data-testid="trend"]'));

    const trends = [];

    for (const trendElement of trendElements) {
    //   const rank = await trendElement.findElement(By.css('div[dir="ltr"]:nth-of-type(1)')).getText().catch(() => null);
      const category = await trendElement.findElement(By.css('div[class*="r-1wbh5a2"]')).getText().catch(() => null);
      const topic = await trendElement.findElement(By.css('div[class*="r-1bymd8e"]')).getText().catch(() => null);
      const posts = await trendElement.findElement(By.css('div[class*="r-14gqq1x"]')).getText().catch(() => null);

      trends.push({
        // rank: rank || 'N/A',
        category: category || 'N/A',
        topic: topic || 'N/A',
        posts: posts || 'N/A',
      });
    }

    return {
      uniqueID: uuidv4(),
      dateTime: new Date().toISOString(),
      trends: trends.slice(0,5),
    };
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await driver.quit();
  }
};

// API to Run the Script
app.post('/run-script', async (req, res) => {
  try {
    const { uniqueID, dateTime, trends } = await scrapeTrends();

    // Save to MongoDB
    const newTrend = new Trend({ uniqueID, trends, dateTime });
    await newTrend.save();

    res.json(newTrend);
  } catch (error) {
    console.error('Error during scraping process:', error);
    res.status(500).send('Error scraping trends');
  }
});

// API to Fetch Trends from Database
app.get('/trends', async (req, res) => {
  try {
    const trends = await Trend.find().sort({ dateTime: -1 });
    res.json(trends);
  } catch (error) {
    console.error('Error fetching trends from DB:', error);
    res.status(500).send('Error fetching trends');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
