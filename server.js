const express = require('express');
const cors = require('cors');
const db = require("./utils/db");
const User = require('./routes/users.js');
console.log("runninginnodemon");



const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cors());

app.use('/user', User);


app.get('/api/health', (req, res) => {
  res.status(200).send({ success: true })
});


app.listen(process.env.PORT || 3001);
console.log("listening on port" + (process.env.PORT || 3001));