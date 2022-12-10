const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = express.Router();
const sharp = require("sharp");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const { v4: uuidv4 } = require("uuid");
const aws = require("aws-sdk");
// <snippet_imports>
("use strict");
const async = require("async");
const fs = require("fs");
const https = require("https");
const path = require("path");
const createReadStream = require("fs").createReadStream;
const sleep = require("util").promisify(setTimeout);
const ComputerVisionClient =
  require("@azure/cognitiveservices-computervision").ComputerVisionClient;
const ApiKeyCredentials = require("@azure/ms-rest-js").ApiKeyCredentials;
// </snippet_imports>

// <snippet_vars>
/**
 * AUTHENTICATE
 * This single client is used for all examples.
 */
//const key = "bec9301e877e4ce8ace78fb1318e00fb";
const key = "187296164919471880fba195872d4789";

//const endpoint = "https://cvtushar941.cognitiveservices.azure.com/";
const endpoint = "https://mscvtushar.cognitiveservices.azure.com/";
// </snippet_vars>
// </snippet_imports_and_vars>

// <snippet_client>
const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": key } }),
  endpoint
);
// </snippet_client>
/**
 * END - Authenticate
 */
aws.config.loadFromPath("routes/aws_config.json");
const s3 = new aws.S3();

const S3_BUCKET = "image-uploads-storage-tushar";

const db = require("../utils/db");

process.env.SECRET_KEY = "HMS";

//registerstart
User.post("/register", (req, res) => {
  console.log("reached ./register");
  const UserData = {
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  };
  let find = {
    text: "SELECT * FROM users WHERE email = $1",
    values: [UserData.email],
  };

  db.query(find, (err1, result1) => {
    /*if(err1) {console.log(err1);
              
          }*/

    if (result1.rows[0] == undefined) {
      bcrypt.hash(req.body.password, 10, (err, hash) => {
        UserData.password = hash;
        const create = {
          text: "INSERT INTO users(name,email,password) VALUES ( $1,$2,$3)",
          values: [UserData.name, UserData.email, UserData.password],
        };

        db.query(create, (err2, result2) => {
          if (err2) console.log("err2" + err2);
          res.send("Registered sucessfully");
        });
      });
    } else {
      res.send("email already exist...");
    }
  });
});
//registerend

//loginstart
User.post("/login", (req, res) => {
  console.log("reached ./login");
  let find = {
    text: "SELECT id,password FROM users WHERE email = $1",
    values: [req.body.email],
  };

  db.query(find, (err, result) => {
    if (err) console.log(err);
    // console.log(result);

    if (result.rows[0] != undefined) {
      if (bcrypt.compareSync(req.body.password, result.rows[0].password)) {
        let token = jwt.sign(
          { id: result.rows[0].id, org: "U" },
          process.env.SECRET_KEY
        );

        res.send(token);
      } else {
        res.send("Password is incorrect");
      }
    } else {
      res.send("Email not found");
    }
  });
});
//loginhospitalend

/*function uploadToS3(key, buffer, mimetype) {

  const params = {
    Bucket: S3_BUCKET,
    Key: key, 
    Body: buffer
};

s3.upload(params, function(err, data) {
  if (err) {
      throw err;
  }
  console.log(`File uploaded successfully. ${data.Location}`);
});
}*/
async function uploadToS3(key, buffer, mimetype) {
  return new Promise((resolve, reject) => {
    s3.putObject(
      {
        Bucket: S3_BUCKET,
        ContentType: mimetype,
        Key: key,
        Body: buffer,
      },
      () => resolve()
    );
  });
}

async function getanalysetag(buffer){
  console.log("reached analyse");
   // <snippet_features_remote>
  // Get the visual feature for analysis
  const features = ["Tags", "Description", "Objects", "Brands", "ImageType"];
  const domainDetails = ["Landmarks"];
  // </snippet_features_remote>
  // Describe local image
  // DescribeImageInStream takes a function that returns a ReadableStream, NOT just a ReadableStream instance.
  const captionLocal = await computerVisionClient.analyzeImageInStream(
    () => buffer,
    { visualFeatures: features, details: domainDetails }
  );

  return captionLocal;
}

async function getocrtag(buffer){
  // <snippet_statuses>
  // Status strings returned from Read API. NOTE: CASING IS SIGNIFICANT.
  // Before Read 3.0, these are "Succeeded" and "Failed"
  const STATUS_SUCCEEDED = "succeeded";
  const STATUS_FAILED = "failed";
  // </snippet_statuses>
  // Call API, returns a Promise<Models.readInStreamResponse>
  const streamResponse = await computerVisionClient
    .readInStream(() => buffer)
    .then((response) => {
      return response;
    });
  // Get operation location from response, so you can get the operation ID.
  const operationLocationLocal = streamResponse.operationLocation;
  // Get the operation ID at the end of the URL
  const operationIdLocal = operationLocationLocal.substring(
    operationLocationLocal.lastIndexOf("/") + 1
  );

  // Wait for the read operation to finish, use the operationId to get the result.
  let trys = 0;
  while (trys < 20) {
    trys += 1;
    const readOpResult = await computerVisionClient
      .getReadResult(operationIdLocal)
      .then((result) => {
        return result;
      });
    console.log("Read status: " + readOpResult.status);
    if (readOpResult.status === STATUS_FAILED) {
      console.log("The Read File operation has failed.");
      break;
    }
    if (readOpResult.status === STATUS_SUCCEEDED) {
      console.log("The Read File operation was a success.");
      console.log();
      console.log("Read File local image result:");
      // Print the text captured

      // Looping through: pages of result from readResults[], then Line[]
      return   readOpResult.analyzeResult.readResults;
      /*for (const textRecResult of readOpResult.analyzeResult.readResults) {
        for (const line of textRecResult.lines) {
          console.log(line.text);
        }
      }*/
      
    }
    await sleep(1000);
  }
}

User.post("/upload", upload.single("image"), async (req, res) => {
  //console.log(req.file);
  if(!req.headers["authorization"]){
    console.log("jwt no1");
   return res.send("login frist");
  }
  console.log("jwt no");
  let user_log = jwt.verify(
    req.headers["authorization"],
    process.env.SECRET_KEY
  );
  if (user_log.org != "U") {
    res.send("only users have access, login as user first");
    return;
  }
  const cvtags = {};
  const id = uuidv4();
  const thumbnailId = id;
  const thumbnail = await sharp(req.file.buffer).resize(200).toBuffer();
  console.log(req.file.size);
  

  console.log("reached analyse");
   // <snippet_features_remote>
  // Get the visual feature for analysis
  const features = ["Tags", "Description", "Objects", "Brands", "ImageType"];
  const domainDetails = ["Landmarks"];
  // </snippet_features_remote>
  // Describe local image
  // DescribeImageInStream takes a function that returns a ReadableStream, NOT just a ReadableStream instance.
   cvtags["analyse"] = await computerVisionClient.analyzeImageInStream(
    () => req.file.buffer,
    { visualFeatures: features, details: domainDetails }
  );
  // <snippet_statuses>
  // Status strings returned from Read API. NOTE: CASING IS SIGNIFICANT.
  // Before Read 3.0, these are "Succeeded" and "Failed"
  const STATUS_SUCCEEDED = "succeeded";
  const STATUS_FAILED = "failed";
  // </snippet_statuses>
  // Call API, returns a Promise<Models.readInStreamResponse>
  const streamResponse = await computerVisionClient
    .readInStream(() => req.file.buffer)
    .then((response) => {
      return response;
    });
  // Get operation location from response, so you can get the operation ID.
  const operationLocationLocal = streamResponse.operationLocation;
  // Get the operation ID at the end of the URL
  const operationIdLocal = operationLocationLocal.substring(
    operationLocationLocal.lastIndexOf("/") + 1
  );

  // Wait for the read operation to finish, use the operationId to get the result.
  let trys = 0;
  while (trys < 20) {
    trys += 1;
    const readOpResult = await computerVisionClient
      .getReadResult(operationIdLocal)
      .then((result) => {
        return result;
      });
    console.log("Read status: " + readOpResult.status);
    if (readOpResult.status === STATUS_FAILED) {
      console.log("The Read File operation has failed.");
      break;
    }
    if (readOpResult.status === STATUS_SUCCEEDED) {
      console.log("The Read File operation was a success.");
      console.log();
      console.log("Read File local image result:");
      // Print the text captured

      // Looping through: pages of result from readResults[], then Line[]
        cvtags["read"] =  readOpResult.analyzeResult.readResults;
        break;
      //for (const textRecResult of readOpResult.analyzeResult.readResults) {
      //  for (const line of textRecResult.lines) {
      //    console.log(line.text);
      //  }
      //}
      }
    await sleep(1000);
  }
   
  //cvtags["read"] = await getocrtag(req.file.buffer);
  //res.send(cvtags);

  await Promise.all([
    uploadToS3(`images/${id}`, req.file.buffer, req.file.mimetype),
    uploadToS3(`thumbnails/${thumbnailId}`, thumbnail, req.file.mimetype),
  ]);

  const create = {
    text: "INSERT INTO images(id,user_id,file_name,image_key,thumbnail_key,caption,tags,CVtags) VALUES ( $1,$2,$3,$4,$5,$6,$7,$8)",
    values: [
      id,
      user_log.id,
      req.file.originalname,
      `images/${id}`,
      `thumbnails/${thumbnailId}`,
      req.body.caption,
      req.body.tags,
      cvtags,
    ],
  };
  db.query(create, (err2, result2) => {
    if (err2){ console.log(err2);
      res.send("err2");
    }
    res.send("uploaded image and created entry");
  });

});

function getSignedUrl(bucket, key, expires = 3600) {
  return new Promise((resolve, reject) => {
    s3.getSignedUrl(
      "getObject",
      {
        Bucket: bucket,
        Key: key,
        Expires: expires,
      },
      function (err, url) {
        if (err) throw new Error(err);

        resolve(url);
      }
    );
  });
}

User.post("/showallwith", async (req, res) => {
    //console.log(req.file);
    console.log("reached search")
    if(!req.headers["authorization"]){
      return res.send("login frist");
    }
    let user_log = jwt.verify(
      req.headers["authorization"],
      process.env.SECRET_KEY
    );
    if (user_log.org != "U") {
      res.send("only users have access, login as user first");
      return;
    }
    let find;
    console.log(req.body.searchstr);
    if(req.body.searchstr == ""){
     find = {
      text: "SELECT id,file_name,caption,tags FROM images WHERE user_id = $1",
      values: [user_log.id],
    };}
    else{let searchstr = "";
      searchstr += req.body.searchstr.split(" ").join(" or ");
      searchstr += ' or "' + req.body.searchstr + '"';
      console.log(searchstr);
      find = {
        text: "SELECT id,file_name,caption,tags FROM images WHERE user_id = $1 and (searchcol_cv @@ websearch_to_tsquery($2) or searchcol_user @@ websearch_to_tsquery($2))",
        values: [user_log.id,searchstr],
      };
    }
    db.query(find, async (err, result) => {
      if (err) console.log(err);
      if(result.rows.length == 0){
        return res.send([]);
      }
      uploadList = await Promise.all(
        result.rows.map(async upload => {
          const thumbnailUrl = await Promise.all([
            getSignedUrl(S3_BUCKET, `thumbnails/${upload.id}`),
          ])
          upload["thumbnail"] = thumbnailUrl[0];
          return upload;
        })
      );
      res.send(uploadList);
    });
});

User.post("/image",async (req,res)=>{
  if(!req.headers["authorization"]){
    return res.send("login frist");
  }
  let user_log = jwt.verify(
    req.headers["authorization"],
    process.env.SECRET_KEY
  );
  if (user_log.org != "U") {
    res.send("only users have access, login as user first");
    return;
  }
  id = req.body.id;
  let find = {
    text: "SELECT id,file_name,caption,tags FROM images WHERE id = $1 and user_id = $2",
    values: [id,user_log.id],
  };
  db.query(find, async (err, result) => {
    if (err) console.log(err);
    if(result.rows.length == 0){
      res.send("no access or no image");
    }
    uploadList = await Promise.all(
      result.rows.map(async upload => {
        const imageUrl = await Promise.all([
          getSignedUrl(S3_BUCKET, `images/${upload.id}`),
        ])
        upload["image"] = imageUrl[0];
        return upload;
      })
    );
    res.send(uploadList);
  });
})

User.post("/test", upload.single("image"), async (req, res) => {
  let redf = {};
  // <snippet_features_remote>
  // Get the visual feature for analysis
  const features = ["Tags", "Description", "Objects", "Brands", "ImageType"];
  const domainDetails = ["Landmarks"];
  // </snippet_features_remote>
  // Describe local image
  //console.log('\nAnalyzing local image to describe...', req.file.filename);
  // DescribeImageInStream takes a function that returns a ReadableStream, NOT just a ReadableStream instance.
  const captionLocal = await computerVisionClient.analyzeImageInStream(
    () => req.file.buffer,
    { visualFeatures: features, details: domainDetails }
  );
  console.log(captionLocal.description.tags);
  console.log(captionLocal.description.captions);
  //console.log(`This may be ${caption.text} (${captionLocal.confidence.toFixed(2)} confidence)`);
  /**
   * END - Describe Image
   * */
  // <snippet_statuses>
  // Status strings returned from Read API. NOTE: CASING IS SIGNIFICANT.
  // Before Read 3.0, these are "Succeeded" and "Failed"
  const STATUS_SUCCEEDED = "succeeded";
  const STATUS_FAILED = "failed";
  // </snippet_statuses>
  // Call API, returns a Promise<Models.readInStreamResponse>
  const streamResponse = await computerVisionClient
    .readInStream(() => req.file.buffer)
    .then((response) => {
      return response;
    });
  // Get operation location from response, so you can get the operation ID.
  const operationLocationLocal = streamResponse.operationLocation;
  // Get the operation ID at the end of the URL
  const operationIdLocal = operationLocationLocal.substring(
    operationLocationLocal.lastIndexOf("/") + 1
  );

  // Wait for the read operation to finish, use the operationId to get the result.
  while (true) {
    const readOpResult = await computerVisionClient
      .getReadResult(operationIdLocal)
      .then((result) => {
        return result;
      });
    console.log("Read status: " + readOpResult.status);
    if (readOpResult.status === STATUS_FAILED) {
      console.log("The Read File operation has failed.");
      break;
    }
    if (readOpResult.status === STATUS_SUCCEEDED) {
      console.log("The Read File operation was a success.");
      console.log();
      console.log("Read File local image result:");
      // Print the text captured

      // Looping through: pages of result from readResults[], then Line[]
      redf["readapi"] = readOpResult.analyzeResult.readResults;
      for (const textRecResult of readOpResult.analyzeResult.readResults) {
        for (const line of textRecResult.lines) {
          console.log(line.text);
        }
      }
      break;
    }
    await sleep(1000);
  }
  redf["analyseapi"] = captionLocal;
  res.send(redf);
});

module.exports = User;
