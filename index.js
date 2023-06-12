const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.Payment_Secret_Key)
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
        // await client.connect();

        const usersCollection = client.db('coutureCamp').collection('users')
        const classesCollection = client.db('coutureCamp').collection('classes')
        const instructorsCollection = client.db('coutureCamp').collection('instructors')
        const cartCollection = client.db('coutureCamp').collection('cart')
        const instructorClassCollection = client.db('coutureCamp').collection('instructorClasses')
        const paymentCollection = client.db('coutureCamp').collection('payments')

        // verify admin middlewere
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email: email });
            if (user.role !== 'admin') {
                res.status(403).send({ error: true, message: 'forbidden access request' })
            }
            next()
        }

        // verify instructor middlewere
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email: email });
            if (user.role !== 'instructor') {
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



        // -------------------CLASSES-------------------

        // send all classes except which are pending
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find({ status: 'approved' }).toArray()
            res.send(result)
        })

        // popular classes
        app.get('/classes/popular', async (req, res) => {
            const result = await classesCollection.find().sort({ students: -1 }).limit(6).toArray()
            res.send(result)
        })

        // add class to instructor classes
        app.post('/class/add', verifyJWT, verifyInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass)
            res.send(result)
        })

        // send instructor classes for instructor by email
        app.get('/classes/instructor/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.params.email;
            const result = await classesCollection.find({ instructorEmail: email }).toArray()
            res.send(result)
        })

        // delete class form instructor classes collection
        app.delete('/class/:id', verifyJWT, verifyInstructor, async (req, res) => {
            const id = req.params.id
            const result = await classesCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        // send all instructor classes for admin only (manage classes)
        app.get('/classes/admin/all', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().sort({ status: 1 }).toArray()
            res.send(result)
        })

        // class status change to approved or denied. if approved add to classCollection
        app.patch('/instructor-class/status/admin', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.body.id;
            const newStatus = req.body.status;
            const result = await classesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: newStatus } })
            res.send(result);
        })

        // update class admin feedback
        app.patch('/instructor-class/feedback', verifyJWT, verifyAdmin, async (req, res) => {
            const feedback = req.body.feedback
            const id = req.body.id;
            const result = await classesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { feedback: feedback } })
            res.send(result)
        })




        // ------------------INSTRUCTORS ----------------- 
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray()
            res.send(result)
        })

        // popular instructors
        app.get('/instructors/popular', async (req, res) => {
            const result = await instructorsCollection.find().sort({ students: -1 }).limit(6).toArray()
            res.send(result)
        })






        // -------------USER- ADD USER TO COLLECTION-------------------
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

        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.status(401).send({ error: true, message: 'unauthorized user request' })
            }
            else {
                const result = await usersCollection.findOne({ email: email })
                res.send(result)
            }
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





        // -------------------CART-----------------------
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
            }

            const result = await cartCollection.find({ email: email }).toArray()
            res.send(result)
        })





        // --------------------Payment intent-------------------
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const price = req.body.total;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        // ---------------------- payment collection-----------------------
        app.post('/class/payment', async (req, res) => {
            const paidClass = req.body
            const classCartId = paidClass._id
            const cartResult = await cartCollection.deleteOne({ _id: new ObjectId(classCartId) })
            if (cartResult.deletedCount > 0) {
                delete paidClass._id
                paidClass.date = new Date()
                const paymentResult = await paymentCollection.insertOne(paidClass)

                const updateClassRes = await classesCollection.updateOne(
                    { _id: new ObjectId(paidClass.itemId) },
                    {
                        $inc: { students: 1, availableSeats: -1 }
                    }
                )

                console.log(paidClass.instructorEmail, paymentResult, updateClassRes);
                res.send({ success: true })
            }
        })

        // ckecks if a class if paid 
        app.patch('/payments/user/paid', verifyJWT, async (req, res) => {
            const id = req.body.id
            const email = req.body.email
            const result = await paymentCollection.findOne({
                $and: [
                    { itemId: id },
                    { email: email }
                ]
            })
            if (result) {
                res.send({ exists: true })
            }
            else {
                res.send({ exists: false })
            }
        })


        // gives specific users enrolled classes
        app.get('/payment/user/classes/:email', async (req, res) => {
            const email = req.params.email;
            const result = await paymentCollection.find({ email: email }).sort({ date: -1 }).toArray()
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
