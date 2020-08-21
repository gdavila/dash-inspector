const express = require('express');
const app = express();
const path = require('path');
const router = express.Router();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
  next();
});


app.use(express.static('dash-inspector'));


router.get('/',function(req,res){
  res.sendFile(path.join(__dirname+'/dash-inspector'+'/index.html'));
  //__dirname : It will resolve to your project folder.
});

//add the router
app.use('/', router);
app.listen(process.env.port || 3000);

console.log('Running at Port 3000');