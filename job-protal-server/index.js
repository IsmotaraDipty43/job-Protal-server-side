const express = require('express')
const cors = require('cors')
const app = express()
const jwt = require('jsonwebtoken');
const cookieParser= require('cookie-parser')
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.use(cors({
origin:['http://localhost:5174'],
credentials:true
}))
app.use(express.json())
app.use(cookieParser())


const verifyToken = (req,res,next)=>{
  console.log('verifytoken');
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: "unauthoried user"})
  }
  jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message: "Unauthoried acess"})
    }
    req.user = decoded;
    next();
  })


}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xsfs6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

const jobCollection= client.db('JobProtal').collection('Jobs')
const JobapplicationCollection= client.db('JobProtal').collection('jobapplication');
// auth related api
app.post('/jwt',async(req,res)=>{
  const user = req.body;
  const token = jwt.sign(user,process.env.JWT_SECRET,{expiresIn:'1h'});
  res
  .cookie('token', token,{
    httpOnly:true,
    secure:false,
    
  })
  .send({success: true})

})

// job api
app.get('/jobs',async(req,res)=>{
  const email = req.query.email;
  let query ={}
  if(email){
    query={hr_email: email}

  }
    const cursor = jobCollection.find(query)
    const result = await cursor.toArray();
    res.send(result)
})
app.get('/jobs/:id',async(req,res)=>{
  const id = req.params.id;
 const query = {_id: new ObjectId(id)}
 const result  = await  jobCollection.findOne(query)
  res.send(result)
})

app.get('/job-applications', verifyToken, async(req,res)=>{
  const email = req.query.email;
  const query = { application_email: email };
  if(req.user.email !== req.query.email){
    return res.status(403).send({message:"forbiden acess"})
  }
  console.log('cuk cuk', req.cookies);
  const result = await JobapplicationCollection.find(query).toArray();
  
  // Fetch job details for each application
  for (const application of result) {
      console.log(application.job_id);
      const query1 = { _id: new ObjectId(application.job_id) }; // Query for job details
      const job = await jobCollection.findOne(query1); // Fetch from jobCollection, not JobapplicationCollection
       
      // If job is found, attach the details to the application object
      if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
      }
  }
  res.send(result);
});

app.post('/jobs',async(req,res)=>{
  const newJob = req.body;
  const result = await jobCollection.insertOne(newJob)
  res.send(result)
})


app.post('/job-applications',async(req,res)=>{
  const application = req.body;
 const result = await JobapplicationCollection.insertOne(application);
 const id= application.job_id;
 const query = {_id: new ObjectId(id)}
 const job = await jobCollection.findOne(query);
 let count = 0;
 if(job.applicationCount){
  count = job.applicationCount + 1;
 }else{
  count = 1;
 }
 const filter = {_id: new ObjectId(id)}
 const updatedDoc={
  $set:{
    applicationCount: count
  }
 }
 const UpdateReault = await jobCollection.updateOne(filter,updatedDoc)
 res.send(result)
})


app.get('/job-applications/jobs/:job_id', async (req, res) => {
  try {
    const jobId = req.params.job_id;
    const query = { job_id: jobId };
    const result = await JobapplicationCollection.find(query).toArray();
    res.status(200).send(result);
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).send({ message: 'An error occurred while fetching job applications.' });
  }
});


app.patch('/job-applications/:id', async (req, res) => {
  const id = req.params.id; // Extracting id from URL params
  const data = req.body;

  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      status: data.status,
    },
  };
  const result = await JobapplicationCollection.updateOne(filter, updateDoc);
  res.send(result);
});




















    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


































app.get('/',(req,res)=>{
    res.send('job is falling from the sky')
})

app.listen(port, ()=>{
    console.log(`job is waitting at: ${port}`);
})