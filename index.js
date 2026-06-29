const express = require("express");
const app = express();
const port = process.env.PORT || 8000;
const cors = require("cors");
require("dotenv").config();
// const { createRemoteJWKSet, jwtVerify } = require("jose");
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_CONNECTION;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



const db = client.db("recipe-hub-server");
const recipeCollection = db.collection("recipe-collection");
const sessionCollection = db.collection("session");
const userCollection = db.collection("user");
const myFavoritesCollections = db.collection("favorites");
const planCollection = db.collection("plans");
const subsCollection = db.collection("subscriptions");
const purchasedRecipes = db.collection("purchasedRecipes");
const featuredCollection = db.collection("featured");
const reportCollection = db.collection("reports");
const likedRecipesCollection = db.collection("likedRecipes");

app.use(cors());
app.use(express.json());


// client.connect()
//   .then(() => client.db("admin").command({ ping: 1 }))
//   .then(() => console.log("Successfully connected to MongoDB!"))
//   .catch((err) => console.error("MongoDB connection failed:", err.message));



const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    
    const userId = payload.sub;
    if (!userId) {
       return res.status(401).send({ message: "Invalid token payload" });
    }

    let userQuery;
    if (ObjectId.isValid(userId)) {
      // It might be stored as an ObjectId or string, check ObjectId first
      userQuery = { _id: new ObjectId(userId) };
    } else {
      userQuery = { _id: userId };
    }

    let user = await userCollection.findOne(userQuery);
    
    // Fallback if better-auth stored it purely as string in MongoDB
    if (!user && ObjectId.isValid(userId)) {
      user = await userCollection.findOne({ _id: userId });
    }

    if (!user) {
      return res.status(403).send({ message: "User not found" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error("====== JWT VERIFICATION FAILED ======");
    console.error("Error Message:", error.message);
    console.error("Token that was passed:", token);
    console.error("=====================================");
    return res.status(403).send({ message: "forbidden" });
  }
};


const verifyUser = async (req, res, next) => {
  const user = await req.user;
  if (user.role !== "user") {
    return res.status(403).send({ message: "forbidden" });
  }
  next();
};


const verifyAdmin = async (req, res, next) => {
  const user = await req.user;
  if (user.role !== "admin") {
    return res.status(403).send({ message: "forbidden" });
  }
  next();
};

app.get("/", (req, res) => {
  res.send("recipe hub server is running");
});


    

    
    app.get("/api/recipes", async (req, res) => {
      try {
        
        const page = parseInt(req.query.page) || 1;
        const size = parseInt(req.query.size) || 10;
        const category = req.query.category || "";
        const query = {};
        if (category !== "") {
          query.category = req.query.category;
        }
        const totalRecipes = await recipeCollection.countDocuments(query);
       
        const skipCount = (page - 1) * size;

        
        const cursor = recipeCollection.find(query).skip(skipCount).limit(size);
        const recipes = await cursor.toArray();

        res.json({
          totalRecipes,
          recipes,
        });
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });

    
    app.get("/api/recipes/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!id) {
          return res.status(400).json({ message: "Recipe ID is required" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await recipeCollection.findOne(query);

        if (!result) {
          return res.status(404).json({ message: "Recipe not found" });
        }

        res.json(result);
      } catch (error) {
        console.error("Error fetching recipe by ID:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    

    app.get("/api/recipe/authorId", verifyToken, async (req, res) => {
      try {
        const authorId = req.query.authorId;
        const query = {};

        if (authorId) {
          query.authorId = authorId;
        }

        const cursor = recipeCollection.find(query);
        const result = await cursor.toArray();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    
    app.get("/app/myFavorites", verifyToken, verifyUser, async (req, res) => {
      const userId = req.query.userId;
      const query = {};
      if (req.query.userId) {
        query.userId = req.query.userId;
      }

      const cursor = myFavoritesCollections.find(query);
      const result = await cursor.toArray();
      res.json(result);
    });

    
    app.get("/api/plans", async (req, res) => {
      try {
        const query = {};
        if (req.query.planId) {
          query.planId = req.query.planId;
        }

        
        const result = await planCollection.find(query).toArray();

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    
    app.get(
      "/api/subscriptions",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const cursor = subsCollection.find();
        const subs = await cursor.toArray();
        res.json(subs);
      },
    );

    
    app.get(
      "/api/purchasedData",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const cursor = purchasedRecipes.find();
        const recipes = await cursor.toArray();
        res.json(recipes);
      },
    );

    
    app.get("/api/purchased", verifyToken, verifyUser, async (req, res) => {
      const userEmail = req.query.email;
      const query = {};
      if (req.query.email) {
        query.customerEmail = userEmail;
      }
      const result = await purchasedRecipes.find(query).toArray();
      res.json(result);
    });

    
    app.get("/api/check-purchase", verifyToken, async (req, res) => {
      try {
        const { recipeId } = req.query;

        if (!recipeId) {
          return res.json({ canPurchase: true }); 
        }

        // Check if user is the recipe owner
        const recipe = await recipeCollection.findOne({ _id: new ObjectId(recipeId) });
        if (recipe && recipe.authorId === req.user._id.toString()) {
          return res.json({
            canPurchase: false,
            message: "You cannot purchase your own recipe.",
          });
        }

        const query = { customerEmail: req.user.email, recipeId };
        const alreadyPurchased = await purchasedRecipes.findOne(query);

        if (alreadyPurchased) {
          return res.json({
            canPurchase: false,
            message: "You have already purchased this recipe!",
          });
        }

        return res.json({ canPurchase: true });
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    });

    
    app.get("/api/premiumuser", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const query = { plan: "Recipehub_Premium" };
        const cursor = userCollection.find(query);
        const users = await cursor.toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });

    
    app.get("/api/reports", verifyToken, verifyAdmin, async (req, res) => {
      const cursor = reportCollection.find();
      const result = await cursor.toArray();
      res.json(result);
    });

    
    app.get("/api/featured", async (req, res) => {
      const cursor = featuredCollection.find();
      const recipes = await cursor.toArray();
      res.json(recipes);
    });

    
    app.get("/api/featured/:id", verifyToken, verifyUser, async (req, res) => {
      const id = req.params.id;
      console.log(id, "id");

      const query = { _id: new ObjectId(id) }; 

      const result = await featuredCollection.findOne(query);
      console.log(result, "recipe");
      res.json(result);
    });

    
    app.get("/api/mostLiked", async (req, res) => {
      try {
        const result = await recipeCollection
          .find() 
          .sort({ likesCount: -1 }) 
          .limit(4) 
          .toArray(); 

        res.send(result); 
      } catch (error) {
        console.error("Error fetching most liked recipes:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    
    
    app.post("/api/recipes", verifyToken, verifyUser, async (req, res) => {
      const recipe = req.body;
      const newRecipe = {
        ...recipe,
        createdAt: new Date(),
      };
      console.log("Received:", recipe);
      const result = await recipeCollection.insertOne(newRecipe);
      res.json({ insertedId: result.insertedId.toString() });
    });

    
    app.post("/app/myFavorites", verifyToken, verifyUser, async (req, res) => {
      try {
        const data = req.body;
        const { _id, ...recipeData } = data; 

        const recipeId = _id;
        const userId = recipeData.userId; 

        
        const query = { userId: userId, recipeId: recipeId };
        const alreadyFavorited = await myFavoritesCollections.findOne(query);

        if (alreadyFavorited) {
          
          return res.status(400).json({
            success: false,
            message: "You have already added this recipe to your favorites!",
          });
        }

        
        const favorite = {
          ...recipeData,
          recipeId: recipeId,
          createdAt: new Date(),
        };

        
        const result = await myFavoritesCollections.insertOne(favorite);

        res.status(201).json({
          success: true,
          message: "Added to favorites successfully",
          data: result,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    
    app.post("/api/featuring", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const data = req.body;
        const recipeId = data._id; 

        if (!recipeId) {
          return res
            .status(400)
            .json({ success: false, message: "Recipe ID is required" });
        }

        
        const query = { recipeId: recipeId };
        const alreadyFeatured = await featuredCollection.findOne(query);

        
        const recipeFilter = { _id: new ObjectId(recipeId) };

        if (alreadyFeatured) {
          

          
          await featuredCollection.deleteOne(query);

          
          await recipeCollection.updateOne(recipeFilter, {
            $set: { isFeatured: false },
          });

          return res.status(200).json({
            success: true,
            message: "Removed from featured successfully",
            isFeatured: false,
          });
        } else {
          

          
          const { _id, ...restOfData } = data;
          const featured = {
            ...restOfData,
            recipeId: recipeId,
            createdAt: new Date(),
          };

          
          const result = await featuredCollection.insertOne(featured);

          
          await recipeCollection.updateOne(recipeFilter, {
            $set: { isFeatured: true },
          });

          return res.status(201).json({
            success: true,
            message: "Added to featured successfully",
            isFeatured: true,
            data: result,
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
      }
    });

    
    app.post("/api/subs", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        const subsInfo = {
          ...data,
          createdAt: new Date(),
        };

        const userEmail = subsInfo.customerEmail;
        const recipeId = subsInfo.recipeId;
        const sessionId = subsInfo.sessionId; 

        
        
        
        if (recipeId) {
          
          // Check if user is the recipe owner
          const recipe = await recipeCollection.findOne({ _id: new ObjectId(recipeId) });
          if (recipe && recipe.authorId === req.user._id.toString()) {
            return res.status(403).json({
              success: false,
              message: "You cannot purchase your own recipe.",
            });
          }

          if (sessionId) {
            const sessionCheck = await purchasedRecipes.findOne({
              sessionId: sessionId,
            });
            if (sessionCheck) {
              return res.status(200).json({
                
                success: true,
                message: "This purchase has already been recorded!",
              });
            }
          }

          const query = { customerEmail: userEmail, recipeId: recipeId };
          const alreadyPurchased = await purchasedRecipes.findOne(query);

          if (alreadyPurchased) {
            return res.status(409).json({
              success: false,
              message: "You have already purchased this recipe!",
            });
          }

          const result = await purchasedRecipes.insertOne(subsInfo);

          return res.status(201).json({
            success: true,
            message: "Recipe purchased successfully",
            data: result,
          });
        }

        
        
        
        if (!recipeId) {
          
          if (sessionId) {
            const sessionCheck = await subsCollection.findOne({
              sessionId: sessionId,
            });
            if (sessionCheck) {
              return res.status(200).json({
                success: true,
                message: "This subscription has already been recorded!",
              });
            }
          }

          
          const result = await subsCollection.insertOne(subsInfo);

          
          const filter = { email: userEmail };
          const updateDocument = {
            $set: { plan: data.planId },
          };
          await userCollection.updateOne(filter, updateDocument);

          return res.status(201).json({
            success: true,
            message: "Subscription added successfully",
            data: result,
          });
        }
      } catch (error) {
        console.error("Error in /api/subs:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
    });

    
    app.post("/api/reports", verifyToken, verifyUser, async (req, res) => {
      try {
        const report = req.body;
        if (!report) {
          return res.status(400).json({
            success: false,
            message: "Report Not Found",
          });
        }

        const userId = req.body.userId;
        const recipeId = req.body.recipeId;
        const query = { userId: userId, recipeId: recipeId };
        const isReported = await reportCollection.findOne(query);
        if (isReported) {
          return res.status(400).json({
            success: false,
            message: "You already Reported",
          });
        }

        const result = reportCollection.insertOne(report);
        return res.status(200).json({
          success: true,
          message: "Thank you for your report. We will review it.",
          data: result,
        });
      } catch (error) {
        
        console.error("Error in /api/reports:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
    });

    
    app.post("/app/liked", verifyToken, verifyUser, async (req, res) => {
      const { recipeId, userId, creatorId } = req.body; 

      
      if (!recipeId || !userId || !creatorId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      try {
        const rId = new ObjectId(recipeId);
        const uId = new ObjectId(userId);
        const cId = new ObjectId(creatorId);

        
        const alreadyLiked = await likedRecipesCollection.findOne({
          recipeId: rId,
          userId: uId,
        });

        if (alreadyLiked) {
          return res
            .status(400)
            .json({ message: "You already liked this recipe" });
        }

        
        await likedRecipesCollection.insertOne({
          recipeId: rId,
          userId: uId,
          createdAt: new Date(),
        });

        
        const recipeUpdate = await recipeCollection.updateOne(
          { _id: rId },
          { $inc: { likesCount: 1 } },
        );

        
        const creatorUpdate = await userCollection.updateOne(
          { _id: cId },
          { $inc: { likesCount: 1 } },
        );

        
        if (
          recipeUpdate.modifiedCount === 0 ||
          creatorUpdate.modifiedCount === 0
        ) {
          return res
            .status(404)
            .json({ message: "Recipe or Creator not found" });
        }

        res.status(200).json({ success: true, message: "Liked successfully!" });
      } catch (error) {
        console.error("Error updating likes:", error);
        res
          .status(500)
          .json({ message: "Internal server error", error: error.message });
      }
    });

    
    

    app.patch("/api/recipes", verifyToken, async (req, res) => {
      try {
        const id = req.body.id;

        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID not found" });
        }

        const updatedData = req.body;
        if (!updatedData) {
          return res
            .status(400)
            .json({ success: false, message: "Data not found" });
        }
        const query = { _id: new ObjectId(id) };
        
        const updateFields = {};

        
        for (const key in updatedData) {
          
          if (key !== "id" && updatedData[key] !== "") {
            updateFields[key] = updatedData[key];
          }
        }

        if (Object.keys(updateFields).length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "No valid fields to update" });
        }

        
        const result = await recipeCollection.updateOne(query, {
          $set: updateFields,
        });

        if (result.modifiedCount === 0) {
          return res
            .status(200)
            .json({ success: true, message: "No changes made to the recipe" });
        }

        return res
          .status(200)
          .json({ success: true, message: "Recipe updated successfully" });
      } catch (error) {
        console.error(error);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    
    app.patch("/api/user", verifyToken, verifyUser, async (req, res) => {
      try {
        const id = req.body.id;

        if (!id) {
          return res
            .status(400)
            .json({ success: false, message: "ID not found" });
        }

        const updatedData = req.body;
        if (!updatedData) {
          return res
            .status(400)
            .json({ success: false, message: "Data not found" });
        }
        const query = { _id: new ObjectId(id) };
        
        const updateFields = {};

        
        for (const key in updatedData) {
          
          if (key !== "id" && updatedData[key] !== "") {
            updateFields[key] = updatedData[key];
          }
        }

        if (Object.keys(updateFields).length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "No valid fields to update" });
        }

        
        const result = await userCollection.updateOne(query, {
          $set: updateFields,
        });

        if (result.modifiedCount === 0) {
          return res
            .status(200)
            .json({ success: true, message: "No changes made to the recipe" });
        }

        return res
          .status(200)
          .json({ success: true, message: "Recipe updated successfully" });
      } catch (error) {
        console.error(error);
        return res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    
    app.patch(
      "/api/admin/user-status",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.body.id;
          const blockedInput = req.body.blocked;

          if (!id) {
            return res
              .status(400)
              .json({ success: false, message: "User ID is required" });
          }

          if (
            blockedInput === undefined ||
            blockedInput === null ||
            blockedInput === ""
          ) {
            return res
              .status(400)
              .json({ success: false, message: "Blocked value is required" });
          }

          
          const targetUser = await userCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!targetUser) {
            return res
              .status(404)
              .json({ success: false, message: "User not found" });
          }

          
          if (targetUser.role === "admin") {
            return res.status(403).json({
              success: false,
              message: "Administrators cannot be blocked",
            });
          }

          
          if (targetUser._id.toString() === req.user._id.toString()) {
            return res.status(403).json({
              success: false,
              message: "You cannot block your own account",
            });
          }

          
          const isBlocked = blockedInput === "true" || blockedInput === true;

          const query = { _id: new ObjectId(id) };

          
          const result = await userCollection.updateOne(query, {
            $set: { blocked: isBlocked },
          });

          if (result.matchedCount === 0) {
            return res
              .status(404)
              .json({ success: false, message: "User not found" });
          }

          if (result.modifiedCount === 0) {
            return res
              .status(200)
              .json({
                success: true,
                message: "No changes made to user status",
              });
          }

          const statusMessage = isBlocked
            ? "User blocked successfully"
            : "User unblocked successfully";
          return res
            .status(200)
            .json({ success: true, message: statusMessage });
        } catch (error) {
          console.error(error);
          return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        }
      },
    );

    

    
    app.delete("/api/recipes", verifyToken, async (req, res) => {
      try {
        const id = req.query.id; 
        console.log(id, "deleted recipe id"); 

        
        if (!id || id === "undefined") {
          return res
            .status(400)
            .json({ success: false, message: "Valid ID is required" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await recipeCollection.deleteOne(query);

        
        return res.json(result);
      } catch (error) {
        console.error("Express Delete Error:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
    });

    
    app.delete("/api/favorite", verifyToken, verifyUser, async (req, res) => {
      try {
        const id = req.query.id; 
        console.log(id, "deleted recipe id"); 

        
        if (!id || id === "undefined") {
          return res
            .status(400)
            .json({ success: false, message: "Valid ID is required" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await myFavoritesCollections.deleteOne(query);

        
        return res.json(result);
      } catch (error) {
        console.error("Express Delete Error:", error);
        return res.status(500).json({ success: false, message: error.message });
      }
    });

    
    app.delete("/api/report", verifyToken, verifyAdmin, async (req, res) => {
      try {
        
        const { recipeId, _id } = req.body;

        if (!recipeId || !_id) {
          return res
            .status(400)
            .json({ message: "recipeId and report id are required" });
        }

        
        const recipeResult = await recipeCollection.deleteOne({
          _id: new ObjectId(recipeId),
        });

        
        const reportResult = await reportCollection.deleteOne({
          _id: new ObjectId(_id),
        });

        
        if (
          recipeResult.deletedCount === 0 &&
          reportResult.deletedCount === 0
        ) {
          return res
            .status(404)
            .json({ message: "No recipe or report found to delete" });
        }

        return res.status(200).json({
          success: true,
          message: "Recipe and report deleted successfully",
        });
      } catch (error) {
        return res
          .status(500)
          .json({ message: "Server error", error: error.message });
      }
    });

    

    
    app.delete(
      "/api/reportRemove",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          
          const { _id } = req.body;

          if (!_id) {
            return res.status(400).json({ message: " report id are required" });
          }

          
          const reportResult = await reportCollection.deleteOne({
            _id: new ObjectId(_id),
          });

          
          if (reportResult.deletedCount === 0) {
            return res
              .status(404)
              .json({ message: "No report found to delete" });
          }

          return res.status(200).json({
            success: true,
            message: "report deleted successfully",
          });
        } catch (error) {
          return res
            .status(500)
            .json({ message: "Server error", error: error.message });
        }
      },
    );

app.listen(port, () => {
  console.log(`recipe hub server is running in ${port}`);
});
