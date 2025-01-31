const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173','https://job-protal-28d08.firebaseapp.com', 'https://job-protal-28d08.web.app'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB URI and client setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xsfs6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  console.log('verifyToken called');
  const token = req.cookies.token;
  console.log('Token received:', token);
  
  if (!token) {
    return res.status(401).send({ message: "Unauthorized user" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Establish MongoDB connection
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    const jobCollection = client.db('JobProtal').collection('Jobs');
    const jobApplicationCollection = client.db('JobProtal').collection('jobapplication');

    // Auth-related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',  // Set to true in production
      }).send({ success: true });
    });

    app.post('/logout', async (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Set to true in production
       
      });
      
      res.send({ success: true });
    });
    

    // Job-related APIs
    app.get('/alljobs', async(req, res)=>{
      const jobs = await jobCollection.find().toArray();
      res.send(jobs);
    })
    
    app.get('/jobs', async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { hr_email: email } : {};
        const jobs = await jobCollection.find(query).toArray();
        res.send(jobs);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get('/jobs/:id', async (req, res) => {
      try {
        const jobId = req.params.id;
        const job = await jobCollection.findOne({ _id: new ObjectId(jobId) });
        res.send(job);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get('/job-applications', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (req.user.email !== email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const applications = await jobApplicationCollection.find({ application_email: email }).toArray();
        for (const application of applications) {
          const job = await jobCollection.findOne({ _id: new ObjectId(application.job_id) });
          if (job) {
            application.title = job.title;
            application.company = job.company;
            application.company_logo = job.company_logo;
          }
        }
        res.send(applications);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.post('/jobs', async (req, res) => {
      try {
        const newJob = req.body;
        const result = await jobCollection.insertOne(newJob);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.post('/job-applications', async (req, res) => {
      try {
        const application = req.body;
        const result = await jobApplicationCollection.insertOne(application);

        const jobId = application.job_id;
        const job = await jobCollection.findOne({ _id: new ObjectId(jobId) });
        const applicationCount = job.applicationCount ? job.applicationCount + 1 : 1;

        const updatedDoc = {
          $set: { applicationCount }
        };

        await jobCollection.updateOne({ _id: new ObjectId(jobId) }, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get('/job-applications/jobs/:job_id', async (req, res) => {
      try {
        const jobId = req.params.job_id;
        const applications = await jobApplicationCollection.find({ job_id: jobId }).toArray();
        res.status(200).send(applications);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.patch('/job-applications/:id', async (req, res) => {
      try {
        const applicationId = req.params.id;
        const data = req.body;

        const filter = { _id: new ObjectId(applicationId) };
        const updateDoc = {
          $set: { status: data.status },
        };

        const result = await jobApplicationCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.error);

app.get('/', (req, res) => {
  res.send('Job is falling from the sky');
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
