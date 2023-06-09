const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
        return res.status(401).send({ error: true, message: "unauthorized access request 1" })
    }

    jwt.verify(token, process.env.Secret_Key, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access request 2' })
        }
        req.decoded = decoded
        next()
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const cartCollection = client.db('coutureCamp').collection('cart')

        // verify admin middlewere
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email: email });
            if (user.role !== 'admin') {
                res.status(403).send({ error: true, message: 'forbidden access request' })
            }
            next()
        }


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

        // popular classes
        app.get('/classes/popular', async (req, res) => {
            const result = await classesCollection.find().sort({ students: -1 }).limit(6).toArray()
            res.send(result)
        })


        // INSTRUCTORS  
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray()
            res.send(result)
        })

        // popular instructors
        app.get('/instructors/popular', async (req, res) => {
            const result = await instructorsCollection.find().sort({ students: -1 }).limit(6).toArray()
            res.send(result)
        })






        // USER- ADD USER TO COLLECTION
        app.post('/users', async (req, res) => {
            const newUser = req.body

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

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        // check user role
        app.get('/users/role/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                res.status(401).send({ error: true, message: 'unauthorized request 3' })
            }
            else {
                const result = await usersCollection.findOne({ email: email })
                if (result) {
                    const role = result.role
                    res.send({ role })
                }
            }
        })

        // make admin or instructor
        app.patch('/user/update-role', verifyJWT, verifyAdmin, async (req, res) => {
            const newRole = req.body.newRole;
            const email = req.body.email
            const result = await usersCollection.updateOne({ email: email }, {
                $set: {
                    role: newRole
                }
            })
            res.send(result)
        })

        // deletes user data from cart and user colllection
        app.delete('/user/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            try {
                const cartResult = await cartCollection.deleteMany({ email: email })
                const userResult = await usersCollection.deleteOne({ email: email })

                if (cartResult.deletedCount === 0 && userResult.deletedCount === 0) {
                    throw new Error("did't delete form any account")
                }
                res.send({ status: 'success' })
            }
            catch (err) {
                console.log(err);
                res.status(500).send('Error deleting data');
            }

        })





        // CART
        app.post('/cart', verifyJWT, async (req, res) => {
            const classItem = req.body
            const query = {
                $and: [
                    { itemId: req.body.itemId },
                    { email: req.body.email }
                ]
            }
            const existingClass = await cartCollection.findOne(query)
            if (existingClass) {
                res.send({ exists: 'exists' })
            }
            else {
                const result = await cartCollection.insertOne(classItem)
                res.send(result)
            }
        })

        app.delete('/cart/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/cart', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([])
            }

            else if (req.decoded.email !== email) {
                res.status(401).send({ error: true, message: 'unauthorized access request' })
                console.log(req.decoded.email, email);
            }

            const result = await cartCollection.find({ email: email }).toArray()
            res.send(result)
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
