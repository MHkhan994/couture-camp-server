const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qmhrwse.mongodb.net/?retryWrites=true&w=majority`;

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

        const usersCollection = client.db('coutureCamp').collection('users')
        const classesCollection = client.db('coutureCamp').collection('classes')
        const instructorsCollection = client.db('coutureCamp').collection('instructors')


        // JWT token send during login
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.Secret_Key, { expiresIn: '1d' })

            res.send({ token })
        })

        // CLASSES
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray()
            res.send(result)
        })


        // INSTRUCTORS  
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray()
            res.send(result)
        })

        // USER- ADD USER TO COLLECTION
        app.post('/users', async (req, res) => {
            const newUser = req.body
            console.log(newUser);

            const query = { email: newUser.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                res.send('user exists')
            }
            else {
                const result = await usersCollection.insertOne(newUser)
                res.send(result)
            }
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('couture server running')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
