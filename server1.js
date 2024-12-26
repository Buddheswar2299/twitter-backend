const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { Builder, By,Key, until } = require('selenium-webdriver');
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
            required: true,
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
    // Set up Chrome options
    const options = new chrome.Options();
    // options.addArguments('--headless'); // Headless mode for background processing (remove for debugging)
  
    // Create a new WebDriver instance
    const driver = new Builder().forBrowser('chrome').setChromeOptions(options).build();
  
    try {
      // Navigate to Twitter login page
      await driver.get('https://twitter.com/login');
  
      // Wait for the username field to be located and input the username
    await driver.wait(until.elementLocated(By.css('input[name="text"]')), 15000);
    const emailCompleted =   await driver.findElement(By.css('input[name="text"]')).sendKeys(process.env.TWITTER_EMAIL);

    if(emailCompleted){
        await driver.wait(until.elementLocated(By.css('input[name="text"]')),15000);
        await driver.findElement(By.css('input[name="text"]')).sendKeys(process.env.TWITTER_USERNAME)
    }
  
      // Wait for the password field to be located and input the password
      await driver.wait(until.elementLocated(By.css('input[name="password"]')), 10000);
      await driver.findElement(By.css('input[name="password"]')).sendKeys(process.env.TWITTER_PASSWORD);
  
      // Wait for the login to complete and for the home page to load
      await driver.wait(until.urlContains('home'), 50000);
  
      // Navigate to the Trending topics section
      await driver.get('https://twitter.com/explore/tabs/trending');
  
      // Wait for the trends to load
      await driver.wait(until.elementLocated(By.css('div[data-testid="trend"]')), 10000);
    const trendsElements = await driver.findElements(By.css('div[data-testid="trend"]'));

    const trends = [];

    for (const trendElement of trendElements) {
        // Extract Rank
        const rank = await trendElement
          .findElement(By.css('div[dir="ltr"]:nth-of-type(1)')) // Adjust selector if needed
          .getText()
          .catch(() => null);
  
        // Extract Category
        const category = await trendElement
          .findElement(By.css('div[style*="text-overflow"]')) // Adjust selector if needed
          .getText()
          .catch(() => null);
  
        // Extract Topic
        const topic = await trendElement
          .findElement(By.css('div[class*="css-146c3p1"]')) // Adjust selector if needed
          .getText()
          .catch(() => null);
  
        // Extract Posts (if available)
        const posts = await trendElement
          .findElement(By.css('div[class*="r-1ttztb7"]')) // Adjust selector if needed
          .getText()
          .catch(() => null);
  
        // Store in trends array
        trends.push({
          rank: rank || 'N/A',
          category: category || 'N/A',
          topic: topic || 'N/A',
          posts: posts || 'N/A',
        });
      }
  
      return trends;
    } catch (error) {
      console.error('Error during scraping:', error);
      return [];
    } finally {
      await driver.quit();
    }
  };




// API to Run the Script
app.post('/run-script', async (req, res) => {
  try {
    const { trends, dateTime, uniqueID } = await scrapeTrends();

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
