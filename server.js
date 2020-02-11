const http = require('http');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, "data.json")

var saved = false;

var data = {};

if (!fs.existsSync(dataPath)) {
  data = {total_all_time_users: 0,
          total_daily_users: 0,
          total_weekly_users: 0,
          total_monthly_users: 0,
          pages: {},
          last_reset: {
            day: 1,
            week: 1,
            month: 1
          }};
  fs.writeFileSync(dataPath, JSON.stringify(data));
}
else {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function saveToFile() {
  fs.writeFileSync(dataPath, JSON.stringify(data));
}

process.on("SIGINT", saveAndExit);
process.on("exit", saveAndExit);


function saveAndExit() {
  if (saved) process.exit();
  saved = true;
  saveToFile();
  process.exit();
}

setInterval(saveToFile, 15 * 60 * 1000) // Autosave every 15 mins
setInterval(checkPrune, 5 * 60 * 1000) // Check to see if it's time for a reset every 5 mins

function checkPrune() {
  let currentDate = new Date();
  let msDate = currentDate.getTime()
  if (currentDate.getHours() !== 0) return;
  let args = [false, false, false] // resets [daily, weekly, monthly]
  if (msDate - data.last_reset.day >= 2 * 60 * 60 * 1000) args[0] = true;
  if (currentDate.getDay() === 1 &&
      msDate - data.last_reset.week >= 2 * 24 * 60 * 60 * 1000) args[1] = true;
  if (currentDate.getDate() === 1 &&
      msDate - data.last_reset.month >= 2 * 24 * 60 * 60 * 1000) args[2] = true;
  if (args.includes(true)) {
    console.log(`Resetting [day: ${args[0]}, week: ${args[1]}, month: ${args[2]}] at ${currentDate}`);
    prune(...args);
  };
}

function prune(daily, weekly, monthly) {
  Object.entries(data.pages).forEach(([key, value])=>{
    if (daily) data.pages[key].daily_users = 0;
    if (weekly) data.pages[key].weekly_users = 0;
    if (monthly) data.pages[key].monthly_users = 0;
  })
  let timeStamp = new Date().getTime()
  if (daily) data.last_reset.day = timeStamp;
  if (weekly) data.last_reset.week = timeStamp;
  if (monthly) data.last_reset.month = timeStamp;
}

const server = http.createServer((req, res)=>{
  if (req.method === "POST" && req.url === "/increment_user") {
    let body = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(body).toString();
      if (!body) {
        res.statusCode = 400;
        res.end()
      }
      data.total_all_time_users++;
      data.total_daily_users++;
      data.total_weekly_users++;
      data.total_monthly_users++;

      if (data.pages[body]) {
        data.pages[body].daily_users++;
        data.pages[body].weekly_users++;
        data.pages[body].monthly_users++;
        data.pages[body].total_users++;
      }
      else {
        data.pages[body] = {total_users: 1, daily_users: 1, weekly_users: 1, monthly_users: 1}
      }
      res.statusCode = 200;
      res.end()
    });

  }
  else if (req.method === "GET" && req.url === "/data") {

    res.writeHead(200, {"Content-Type": "application/json"})
    res.write(JSON.stringify(data, null, 2))
    res.end();

  }
  else {
    res.statusCode = 404;
    res.end();
  }
})

checkPrune()

process.on('uncaughtException', (err, origin) => {
  console.log(err)
  process.exit();
});

server.listen(9001, ()=>{
  console.log("Server Online");
})
