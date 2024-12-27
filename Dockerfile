FROM node:16

# Install Chrome and ChromeDriver
RUN apt-get update && apt-get install -y wget unzip \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O chrome.deb \
    && apt install -y ./chrome.deb \
    && rm chrome.deb \
    && wget -q https://chromedriver.storage.googleapis.com/116.0.5845.96/chromedriver_linux64.zip -O /tmp/chromedriver.zip \
    && unzip /tmp/chromedriver.zip -d /usr/bin/ \
    && rm /tmp/chromedriver.zip

# Set environment variables for Chrome and ChromeDriver
ENV CHROME_BIN=/usr/bin/google-chrome
ENV CHROME_DRIVER=/usr/bin/chromedriver

# App setup
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "start"]
