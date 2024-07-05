import express from "express";
import morgan from "morgan";
import bodyparser from "body-parser";
import {fileURLToPath} from "url";
import {dirname} from "path";
import ejs from "ejs";
import pg from "pg";
import axios from "axios";
import passport from "passport";
import session from "express-session";
import { Strategy } from "passport-local";
import env from "dotenv";
import twilio from "twilio";

const port = 3000;
const app = express(); 
env.config();

//twilio config
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const accountAuthToken = process.env.TWILIO_ACCOUNT_AUTHTOKEN;
const client = twilio(accountSid,accountAuthToken);



//dbase connection
const db = new pg.Client({
    user: 'postgres',
    password: 'aditya',
    host: 'localhost',
    port: 5432, // default Postgres port
    database: 'DB_resultSMS'
}) 
db.connect();

app.use(bodyparser.urlencoded({extended:true}));
app.use(express.static('public'));

//intitalise session
app.use(session({
    secret:process.env.TOP_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        maxAge:1000*60*60,
    }
}))

// initialize passport
app.use(passport.initialize());
app.use(passport.session());
//now define local startegy at the end

// const __dirname=dirname(fileURLToPath(import.meta.url));

//twilio:-
async function sms(sender,reciever,e,h,m,s){
    console.log("twilio function has been called!");
    const reportStatus= await client.messages.create({
        body:`marks E:${e} H:${h} M:${m} S:${s}`,
        to:reciever,
        from:sender,
    });
    console.log("Yes"); 
}


app.get("/twl",async (req,res)=>{
    if(req.isAuthenticated()){
        try{
            let query="select * from result where sent = false";
            let result= await db.query(query);
            if(result){
                let i=0;
                while(i<result.rows.length){
                    let sender=process.env.SENDERPHN;
                    let reciever="+91"+result.rows[i].phn;
                    sms(sender,reciever,result.rows[i].english,result.rows[i].hindi,result.rows[i].maths,result.rows[i].science);
                    i++;
                    // console.log(result.rows[i]);
                    // i++;
                }
                
            }
        }catch(err){
            console.log(err.message);
        }
    }
});


app.get("/",(req,res)=>{
   try{
    res.render("login.ejs",{});
   }catch(error){
    console.log(error.message);
   }
});

app.get("/home",(req,res)=>{
    if(req.isAuthenticated()){
        res.render("home.ejs",{name:req.user.username})
    }else{
        res.redirect("/");
    }
});



app.post("/submit",passport.authenticate("local",{
    successRedirect:"/home",
    failureRedirect:"/",
}));

//inserting the form in the database
app.post("/marks",async (req,res)=>{
    try{
        let qry="INSERT INTO result(id,name,english,hindi,maths,science,phN) VALUES($1,$2,$3,$4,$5,$6,$7)";
        const result= await db.query(qry,[req.body["id"],req.body["name"],req.body["english"],req.body["hindi"],req.body["maths"],req.body["science"],req.body["phN"]]);
        if(result){
            let insertMessage=`Last Successfull insertion: ${req.body["name"]},${req.body["id"]}`;
            res.render("home.ejs",{
                name:req.body["username"],
                status:insertMessage,
            })
            console.log(result);
            console.log("updation successfull");
        }
    }catch(error){
        res.render("home.ejs",{
            name:req.body["username"],
            status:error["detail"],
        });
        console.log(error.message);
    }
})



//for anchor button
app.get("/sms",async (req,res)=>{
//also create logic to dislplay the table of the result, by sending it with the ejs file
    if(req.isAuthenticated()){
        console.log("sms route was hit");
    try{
        let qry="SELECT * FROM result;";
        const result=await db.query(qry);
        if(result){
            // console.log(result.rows[0]);//for checking and error handling
            res.render("SMSpage.ejs",{data:result,});
            console.log("query was a success");
        }
        
    }catch(error){
        res.render("SMSpage.ejs",{err:error["detail"],});
        console.log(error.message);
    }
    }else{
        res.redirect("/");
    }
});



app.get("/logout",(req,res)=>{
    req.logout(req.user,(err)=>{
        if(err){
            console.log(err);
        }
        res.redirect("/");
    })
})


//defining local strategy by using {Strategy} from passport-local
passport.use(new Strategy(async function verify(username,password,cb){
    try{
        let qry="select * from teachers WHERE username = $1";
        const result = await db.query(qry,[username]);
        if(result.rows.length>0)
        {
                const user = result.rows[0];
                if(user.password==password){
                    console.log("the credentials were correct")
                    // res.render("home.ejs",{
                    //     name:req.body["username"],
                    // });
                    return cb(null,user);
                }else{
                    return cb(null,false);
                }
        }
        else{
                // res.render("login.ejs",{
                //     msg:"Username or Password did not match",
                // });
                return cb(null,false);
            }
        }catch(error){
                        console.log(error.message);
                    }
}
));

//inserting data to session like session id
passport.serializeUser((user,cb)=>{
    cb(null,user);
});

//deserialising data from session
passport.deserializeUser((user,cb)=>{
    cb(null,user);
})


app.listen(port,()=>{
    console.log("the server is running on port: "+port);
})
