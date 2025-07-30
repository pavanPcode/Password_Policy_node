const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const cors = require("cors"); // ✅ Import CORS
const screenRoutes = require("./server");
require('dotenv').config(); // load environment variables from .env
const net = require('net');

const app = express();
app.use(express.json());
app.use(cors()); // ✅ Enable CORS for all routes

const swaggerDocument = YAML.load('./swagger.yaml');

// For Swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount all routes under /api
app.use("/api", screenRoutes);

const dbConfig = {
  user: "RNDAdmin",
  password: "0f8$4rfT1",
  server: "132.148.105.23",
  database: "RND_HR",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};
// const dbConfig = {
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   server: process.env.DB_SERVER,
//   database: process.env.DB_DATABASE,
//   port: parseInt(process.env.DB_PORT, 10),
//   options: {
//     encrypt: false,
//     trustServerCertificate: true,
//   },
// };

const getPolicy = async () => {
  try {
    const result = await sql.query`SELECT TOP 1 * FROM psw.PasswordPolicy`;
    const row = result.recordset[0];
    console.log('row"-----',row)
    return row || {
      MinLength: 8,
      RequireUppercase: 1,
      RequireLowercase: 1,
      RequireDigit: 1,
      RequireSpecialChar: 1,
      ExpiryDays: 90,
      MaxFailedAttempts: 5,
      ReuseHistoryCount: 5,
      LockoutDurationMinutes: 15,
    };
  } catch (e) {
    console.log("Policy fetch error:", e);
    return {
      MinLength: 8,
      RequireUppercase: 1,
      RequireLowercase: 1,
      RequireDigit: 1,
      RequireSpecialChar: 1,
      ExpiryDays: 90,
      MaxFailedAttempts: 5,
      ReuseHistoryCount: 5,
      LockoutDurationMinutes: 15,
    };
  }
};

// const validatePassword = (password, policy) => {
//   if (password.length <= policy.MinLength-1)
//     return [false, `Password must be at least ${policy.MinLength} characters`];
//   if (policy.RequireUppercase && !/[A-Z]/.test(password))
//     return [false, "Must include an uppercase letter"];
//   if (policy.RequireLowercase && !/[a-z]/.test(password))
//     return [false, "Must include a lowercase letter"];
//   if (policy.RequireDigit && !/\d/.test(password))
//     return [false, "Must include a digit"];
//   if (policy.RequireSpecialChar && !/[\W_]/.test(password))
//     return [false, "Must include a special character"];
//   return [true, "Valid"];
// };
const validatePassword = (password, policy) => {
  if (password.length < policy.MinLength)
    return [false, `Password must be at least ${policy.MinLength} characters`];

  const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
  if (uppercaseCount < policy.RequireUppercase)
    return [false, `Must include at least ${policy.RequireUppercase} uppercase letter(s)`];

  const lowercaseCount = (password.match(/[a-z]/g) || []).length;
  if (lowercaseCount < policy.RequireLowercase)
    return [false, `Must include at least ${policy.RequireLowercase} lowercase letter(s)`];

  const digitCount = (password.match(/\d/g) || []).length;
  if (digitCount < policy.RequireDigit)
    return [false, `Must include at least ${policy.RequireDigit} digit(s)`];

  const specialCharCount = (password.match(/[\W_]/g) || []).length;
  if (specialCharCount < policy.RequireSpecialChar)
    return [false, `Must include at least ${policy.RequireSpecialChar} special character(s)`];

  return [true, "Valid"];
};

function generateRandomPassword(policy) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '@#$%&*!';

  let password = '';
  let allChars = '';
  
  const getRandomChars = (chars, count) => {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  };

  // Add required characters
  if (policy.RequireUppercase > 0) {
    password += getRandomChars(uppercase, policy.RequireUppercase);
    allChars += uppercase;
  }

  if (policy.RequireLowercase > 0) {
    password += getRandomChars(lowercase, policy.RequireLowercase);
    allChars += lowercase;
  }

  if (policy.RequireDigit > 0) {
    password += getRandomChars(digits, policy.RequireDigit);
    allChars += digits;
  }

  if (policy.RequireSpecialChar > 0) {
    password += getRandomChars(special, policy.RequireSpecialChar);
    allChars += special;
  }

  // Fill the rest to meet MinLength
  const remainingLength = policy.MinLength - password.length;
  password += getRandomChars(allChars, remainingLength);

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}


// function generateRandomPassword(policy) {
//   const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
//   const lowercase = 'abcdefghijklmnopqrstuvwxyz';
//   const digits = '0123456789';
//   const special = '@';
//   let allChars = '';
//   let password = '';

//   if (policy.RequireUppercase) {
//     password += uppercase[Math.floor(Math.random() * uppercase.length)];
//     allChars += uppercase;
//   }

//   if (policy.RequireLowercase) {
//     password += lowercase[Math.floor(Math.random() * lowercase.length)];
//     allChars += lowercase;
//   }

//   if (policy.RequireDigit) {
//     password += digits[Math.floor(Math.random() * digits.length)];
//     allChars += digits;
//   }

//   if (policy.RequireSpecialChar) {
//     password += special[Math.floor(Math.random() * special.length)];
//     allChars += special;
//   }

//   // Fill the rest with random characters up to MinLength
//   while (password.length < policy.MinLength) {
//     password += allChars[Math.floor(Math.random() * allChars.length)];
//   }

//   // Shuffle password
//   return password
//     .split('')
//     .sort(() => Math.random() - 0.5)
//     .join('');
// }


async function addActivityLog(ActivityType, PerformedBy, Notes, Location = '') {
  console.log(ActivityType, PerformedBy, Notes, Location = '')
  if (!ActivityType || !PerformedBy ) {
    return { success: false, message: 'Missing required fields' };
  }
  let PerformedOn = new Date(); // assuming current timestamp

  try {
    await sql.connect(dbConfig);
    await sql.query`
      INSERT INTO [dbo].[pereco_ActivityLog] (ActivityType, PerformedBy, PerformedOn, Notes, Location)
      VALUES (${ActivityType}, ${PerformedBy}, ${PerformedOn}, ${Notes}, ${Location})
    `;
    return { success: true, message: 'Activity inserted successfully' };
  } catch (error) {
    console.error('DB Insert Error:', error.message, error);
    return { success: false, message: 'Failed to insert activity' };
  }
}

app.post("/register", async (req, res) => {
  try {

    addActivityLog('26','','register' ,'');

    const { username, name, role } = req.body;
    const policy = await getPolicy();

    const existing = await sql.query`SELECT COUNT(*) as count FROM dbo.pereco_Users WHERE Email = ${username}`;
    if (existing.recordset[0].count > 0)
      return res.status(400).json({ Message: "username already exists", status: false, ResultData: [] });

    const randomPassword = generateRandomPassword(policy);

    console.log("Generated password:", randomPassword);


    const [isValid, msg] = validatePassword(randomPassword, policy);
    if (!isValid) return res.status(400).json({ Message: msg, status: false, ResultData: [] });

    const hash_pw = await bcrypt.hash(randomPassword, 10);
    await sql.query`INSERT INTO dbo.pereco_Users (Name, Email, Role, PasswordHash) VALUES (${name}, ${username}, ${role}, ${hash_pw})`;

    const userIdResult = await sql.query`SELECT UserID FROM dbo.pereco_Users WHERE Email = ${username}`;
    const user_id = userIdResult.recordset[0].UserID;

    const expiryDate = new Date(Date.now() + policy.ExpiryDays * 86400000);
    await sql.query`INSERT INTO psw.UserSecurity (UserID, PasswordChangedOn, PasswordExpiryDate) VALUES (${user_id}, GETDATE(), ${expiryDate})`;
    await sql.query`INSERT INTO psw.PasswordHistory (UserID, PasswordHash) VALUES (${user_id}, ${hash_pw})`;

    res.status(201).json({ Message: "User registered successfully.", status: true, ResultData:  {TemporaryPassword:randomPassword} });
  } catch (e) {
    console.log("Register error:", e);
    res.status(500).json({ Message: "Failed to register user.", status: false, ResultData:{} });
  }
});

app.post("/login", async (req, res) => {
  try {
    addActivityLog('27','','login' ,'');
    const { username, password } = req.body;
    const policy = await getPolicy();

    const result = await sql.query`
      SELECT u.UserID, u.PasswordHash, s.FailedLoginAttempts, s.IsLocked,
             s.PasswordExpiryDate, s.LastFailedAttempt,s.isTemporaryPassword,u.Role,u.Name,u.email  UserName,  (SELECT TOP 1 sessionTimeoutMinutes FROM psw.PasswordPolicy) AS sessionTimeoutMinutes

      FROM dbo.pereco_Users u
      JOIN psw.UserSecurity s ON u.UserID = s.UserID
      WHERE u.Email = ${username}`;

    const row = result.recordset[0];
    if (!row) return res.status(404).json({ Message: "User not found", status: false, ResultData: [] });

    let { UserID, PasswordHash, FailedLoginAttempts, IsLocked, PasswordExpiryDate, LastFailedAttempt,isTemporaryPassword,Role,Name,sessionTimeoutMinutes,UserName } = row;

    // if (IsLocked) {
    //   if (LastFailedAttempt && new Date() - new Date(LastFailedAttempt) > policy.LockoutDurationMinutes * 60000) {
    //     await sql.query`UPDATE psw.UserSecurity SET IsLocked = 0, FailedLoginAttempts = 0 WHERE UserID = ${UserID}`;
    //     IsLocked = 0;
    //   } else {
    //     return res.status(403).json({ Message: "Account is locked. Try again later.", status: false, ResultData: [] });
    //   }
    // }

    if (IsLocked) {
      
      return res.status(403).json({ Message: "Account is locked. Contact Admin to Unlock.", status: false, ResultData: [] });
    }

    if (new Date() > new Date(PasswordExpiryDate)) {
      return res.status(403).json({ Message: "Password expired. Please reset your password.", status: false, ResultData: [] });
    }

    const isMatch = await bcrypt.compare(password, PasswordHash);
    if (isMatch) {
      await sql.query`UPDATE psw.UserSecurity SET FailedLoginAttempts = 0, LastLogin = GETDATE() WHERE UserID = ${UserID}`;
        // Fetch RoleMenu data
      const roleMenuResult = await sql.query`
        SELECT   rm.RoleId, rm.AppMenuId, rm.[Read], rm.[Write],  rm.[Delete], rm.[Export],  am.MenuName, am.MenuPath, am.IconName,rm.id RoleMenuid
          FROM [dbo].[RoleMenu] rm
          INNER JOIN [dbo].[AppMenu] am ON am.id = rm.AppMenuId
        WHERE rm.RoleId = ${Role} and rm.IsActive = 1 and am.IsActive = 1`;

      // Extract the recordset from the result
      const roleMenu = roleMenuResult.recordset;

      return res.json({ Message: "Login successful", status: true, ResultData: {UserID:UserID,isTemporaryPassword:isTemporaryPassword,Role:Role,Name:Name,sessionTimeoutMinutes:sessionTimeoutMinutes,UserName:UserName},roleMenu });
    } else {
      FailedLoginAttempts += 1;
      const isLocked = FailedLoginAttempts >= policy.MaxFailedAttempts ? 1 : 0;
      await sql.query`UPDATE psw.UserSecurity SET FailedLoginAttempts = ${FailedLoginAttempts}, IsLocked = ${isLocked}, LastFailedAttempt = GETDATE() WHERE UserID = ${UserID}`;
      if (isLocked)
        // return res.status(403).json({ Message: `Account is locked due to too many failed attempts. Try again after ${policy.LockoutDurationMinutes} minutes.`, status: false, ResultData: [] }).;
        return res.status(403).json({ Message: `Account is locked due to too many failed attempts.  Contact Admin to Unlock.`, status: false, ResultData: [] });

      return res.status(401).json({ Message: "Incorrect password", status: false, ResultData: [] });
    }
  } catch (e) {
    console.log("Login error:", e);
    res.status(500).json({ Message: "Login failed", status: false, ResultData: [] });
  }
});

app.post("/adminChangePassword", async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    addActivityLog('28',PerformedBy,'adminChangePassword' ,'');

    const { username } = req.body;
    const policy = await getPolicy();

    const new_password = generateRandomPassword(policy);

    console.log("Generated password:", new_password);

    const [isValid, msg] = validatePassword(new_password, policy);
    if (!isValid) return res.status(400).json({ Message: msg, status: false, ResultData: [] });

    const result = await sql.query`SELECT UserID FROM dbo.pereco_Users WHERE Email = ${username}`;
    const row = result.recordset[0];
    if (!row) return res.status(404).json({ Message: "User not found", status: false, ResultData: [] });

    const user_id = row.UserID;
    const new_hash = await bcrypt.hash(new_password, 10);

    const historyResult = await sql.query`SELECT TOP (${policy.ReuseHistoryCount}) PasswordHash FROM psw.PasswordHistory WHERE UserID = ${user_id} ORDER BY ChangedOn DESC`;
    for (let r of historyResult.recordset) {
      if (await bcrypt.compare(new_password, r.PasswordHash)) {
        return res.status(400).json({ Message: "Cannot reuse a recently used password.", status: false, ResultData: [] });
      }
    }

    const expiryDate = new Date(Date.now() + policy.ExpiryDays * 86400000);
    console.log('user_id',user_id)
    await sql.query`UPDATE dbo.pereco_Users SET PasswordHash = ${new_hash} WHERE UserID = ${user_id}`;
    await sql.query`UPDATE psw.UserSecurity SET PasswordChangedOn = GETDATE(), PasswordExpiryDate = ${expiryDate},isTemporaryPassword = 1,IsLocked=0 WHERE UserID = ${user_id}`;
    await sql.query`INSERT INTO psw.PasswordHistory (UserID, PasswordHash) VALUES (${user_id}, ${new_hash})`;

    res.json({ message: "Password changed successfully.", status: true, ResultData:  {TemporaryPassword:new_password} });
  } catch (e) {
    console.log("Change password error:", e);
    res.status(500).json({ message: "Failed to change password", status: false, ResultData: [] });
  }
});


app.post("/UserChangePassword", async (req, res) => {
  try {

    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    addActivityLog('29',PerformedBy,'UserChangePassword' ,'');

    const { username, new_password, old_password } = req.body;
    const policy = await getPolicy();

    const [isValid, msg] = validatePassword(new_password, policy);
    if (!isValid)
      return res.status(400).json({ Message: msg, status: false, ResultData: [] });

    // Get user and password hash
    const result = await sql.query`
      SELECT UserID, PasswordHash 
      FROM dbo.pereco_Users 
      WHERE Email = ${username}`;
    const row = result.recordset[0];

    if (!row)
      return res.status(404).json({ Message: "User not found", status: false, ResultData: [] });

    const user_id = row.UserID;
    const currentHash = row.PasswordHash;

    // Check if old password matches current hash
    const isOldPasswordCorrect = await bcrypt.compare(old_password, currentHash);
    if (!isOldPasswordCorrect)
      return res.status(400).json({ Message: "Old password is incorrect", status: false, ResultData: [] });

    // Check if new password is in password history
    const historyResult = await sql.query`
      SELECT TOP (${policy.ReuseHistoryCount}) PasswordHash 
      FROM psw.PasswordHistory 
      WHERE UserID = ${user_id} 
      ORDER BY ChangedOn DESC`;

    for (let r of historyResult.recordset) {
      if (await bcrypt.compare(new_password, r.PasswordHash)) {
        return res.status(400).json({
          Message: "Cannot reuse a recently used password.",
          status: false,
          ResultData: [],
        });
      }
    }

    const new_hash = await bcrypt.hash(new_password, 10);
    const expiryDate = new Date(Date.now() + policy.ExpiryDays * 86400000);

    await sql.query`UPDATE dbo.pereco_Users SET PasswordHash = ${new_hash} WHERE UserID = ${user_id}`;
    await sql.query`UPDATE psw.UserSecurity 
                    SET PasswordChangedOn = GETDATE(), 
                        PasswordExpiryDate = ${expiryDate}, 
                        isTemporaryPassword = 0 
                    WHERE UserID = ${user_id}`;
    await sql.query`INSERT INTO psw.PasswordHistory (UserID, PasswordHash) VALUES (${user_id}, ${new_hash})`;

    res.json({ message: "Password changed successfully.", status: true, ResultData: [] });
  } catch (e) {
    console.log("Change password error:", e);
    res.status(500).json({ message: "Failed to change password", status: false, ResultData: [] });
  }
});


app.post("/updatepasswordPolicy", async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    addActivityLog('30',PerformedBy,'updatepasswordPolicy' ,'');
    const d = req.body;
    const result = await sql.query`SELECT COUNT(*) as count FROM psw.PasswordPolicy`;
    const count = result.recordset[0].count;

    if (count === 0) {
      await sql.query`INSERT INTO psw.PasswordPolicy (MinLength, RequireUppercase, RequireLowercase, RequireDigit, RequireSpecialChar, ExpiryDays, MaxFailedAttempts, ReuseHistoryCount, LockoutDurationMinutes,sessionTimeoutMinutes) VALUES (${d.MinLength || 8}, ${d.RequireUppercase || 1}, ${d.RequireLowercase || 1}, ${d.RequireDigit || 1}, ${d.RequireSpecialChar || 1}, ${d.ExpiryDays || 90}, ${d.MaxFailedAttempts || 5}, ${d.ReuseHistoryCount || 5}, ${d.LockoutDurationMinutes || 15}, ${d.sessionTimeoutMinutes || 5})`;
    } else {
      await sql.query`UPDATE psw.PasswordPolicy SET MinLength = ${d.MinLength || 8}, RequireUppercase = ${d.RequireUppercase || 1}, RequireLowercase = ${d.RequireLowercase || 1}, RequireDigit = ${d.RequireDigit || 1}, RequireSpecialChar = ${d.RequireSpecialChar || 1}, ExpiryDays = ${d.ExpiryDays || 90}, MaxFailedAttempts = ${d.MaxFailedAttempts || 5}, ReuseHistoryCount = ${d.ReuseHistoryCount || 5}, LockoutDurationMinutes = ${d.LockoutDurationMinutes || 15}, sessionTimeoutMinutes = ${d.sessionTimeoutMinutes || 5}`;
    }

    res.json({ message: "Password policy saved successfully.", status: true, ResultData: [] });
  } catch (e) {
    console.log("Policy save error:", e);
    res.status(500).json({ error: "Failed to save password policy.", status: false, ResultData: [] });
  }
});

app.get("/getPasswordPolicy", async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    addActivityLog('31',PerformedBy,'getPasswordPolicy' ,'');
    const result = await sql.query`SELECT TOP 1 * FROM psw.PasswordPolicy`;
    const row = result.recordset[0];

    if (!row) return res.status(404).json({ error: "No password policy configured.", status: false, ResultData: [] });

    res.json({ error: "", status: false, ResultData: row });
  } catch (e) {
    console.log("Policy fetch error:", e);
    res.status(500).json({ error: "Failed to fetch password policy.", status: false, ResultData: [] });
  }
});

app.post('/addActivity', async (req, res) => {
  try {
    console.log(req.body)
    const { ActivityType, PerformedBy, PerformedOn, Notes, Location,IsSucces } = req.body;
    console.log(ActivityType, PerformedBy, PerformedOn, Notes, Location,IsSucces)
    if (!ActivityType  || !PerformedOn) {
      return res.status(400).json({ message: 'Missing required fields', status: false, ResultData: []  });
    }

    const safeNotes = Notes || '';
    const safeLocation = Location || '';

    await sql.connect(dbConfig);
    await sql.query`
      INSERT INTO [dbo].[pereco_ActivityLog] (ActivityType, PerformedBy, PerformedOn, Notes, Location,IsSucces,LogType)
      VALUES (${ActivityType}, ${PerformedBy}, ${PerformedOn}, ${safeNotes}, ${safeLocation}, ${IsSucces}, 2)
    `;

    res.json({ message: 'Activity inserted successfully', status: true, ResultData: []  });
  } catch (error) {
    console.error('Insert error:', error.message, error);  // Updated for better logs
    res.status(500).json({ message: 'Failed to insert activity', status: false, ResultData: []  });
  }
});

app.get('/getActivities', async (req, res) => {
  try {
    await sql.connect(dbConfig);

    const result = await sql.query(`
      SELECT p.ActivityType, p.PerformedBy, p.PerformedOn, p.Notes, p.Location ,p.IsSucces,p.LogType,pu.Name,pu.Email username
      FROM [dbo].[pereco_ActivityLog]  p
	  left join [dbo].[pereco_Users] pu on pu.UserID = p.PerformedBy
      ORDER BY p.PerformedOn DESC
    `);

    res.json({
      message: "Activities fetched successfully",
      status: true,
      ResultData: result.recordset
    });
  } catch (error) {
    console.error("Fetch error:", error.message, error);
    res.status(500).json({
      message: "Failed to fetch activities",
      status: false,
      ResultData: []
    });
  }
});


// app.post('/addActivity', async (req, res) => {
//   try {
//     const { ActivityType, PerformedBy, Notes, Location } = req.body;

//     const result = await addActivityLog(
//       ActivityType,
//       PerformedBy,
//       Notes || '',
//       Location || ''
//     );

//     if (!result.success) {
//       return res.status(400).json({ message: result.message, status: false, ResultData: [] });
//     }

//     res.json({ message: result.message, status: true, ResultData: [] });
//   } catch (error) {
//     console.error('Unexpected error:', error.message);
//     res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
//   }
// });

'---------------------------------------------------'

app.get('/GetAHUMachines', async (req, res) => {
  try {
    // let ActivityType = '1';
    // let PerformedBy = '2';
    // let Notes = 'GetAHUMachines';
    // let Location = '';
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('1',PerformedBy,'GetAHUMachines' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

app.post('/AddAHUMachines', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('2',PerformedBy,'AddAHUMachines' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/EditAHUMachines', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('3',PerformedBy,'EditAHUMachines' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

app.post('/DeleteAHUMachines', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('4',PerformedBy,'DeleteAHUMachines' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/DeleteAHUFilters', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('5',PerformedBy,'DeleteAHUFilters' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/EditAHUFilters', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('6',PerformedBy,'EditAHUFilters' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});



app.post('/AddAHUFilters', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('7',PerformedBy,'AddAHUFilters' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/GetAHUFilters', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('8',PerformedBy,'GetAHUFilters' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/AHUFiltersUpdateStatus', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('9',PerformedBy,'AHUFiltersUpdateStatus' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

app.post('/AHUFilterGenerateBarcode', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('10',PerformedBy,'AHUFilterGenerateBarcode' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getNotifications', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('11',PerformedBy,'getNotifications' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/AuditTrial', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('12',PerformedBy,'AuditTrial' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});



app.get('/getSchedule', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided

    const result = await addActivityLog('13',PerformedBy,'Schedule' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getDeviationsAlarms', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided

    const result = await addActivityLog('14',PerformedBy,'getDeviationsAlarms' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getReplacementList', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('15',PerformedBy,'getReplacementList' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

app.get('/getRetirementList', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('16',PerformedBy,'getRetirementList' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getUser', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('17',PerformedBy,'getUser' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/AddUser', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('18',PerformedBy,'AddUser' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/EditUser', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('19',PerformedBy,'EditUser' ,'');
    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/DeleteUser', async (req, res) => {
  try {
    const result = await addActivityLog('20','2','DeleteUser' ,'');
    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

app.get('/getRolePermissions', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('21',PerformedBy,'getRolePermissions' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getFilterTypes', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('22',PerformedBy,'getFilterTypes' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/addFilterTypes', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('21',PerformedBy,'addFilterTypes' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/editFilterTypes', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('22',PerformedBy,'editFilterTypes' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.post('/deleteFilterTypes', async (req, res) => {
  try {
    const PerformedBy = req.body.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('23',PerformedBy,'deleteFilterTypes' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getDashboard', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('24',PerformedBy,'getDashboard' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/getSidebar', async (req, res) => {
  try {
    const PerformedBy = req.query.PerformedBy || '2'; // default to '2' if not provided
    const result = await addActivityLog('25',PerformedBy,'getSidebar' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});


app.get('/runScheduleJob', async (req, res) => {
  let pool;
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const inserted = [];

  try {
    pool = await sql.connect(dbConfig);

    const ahus = await pool.request().query(`
      SELECT id, InstalledOn, cleaningFreqAllowance, cleaningdays
      FROM [pereco_AssetItem]
      WHERE IsActive = 1
    `);

    for (const ahu of ahus.recordset) {
      const ahuId = ahu.id;
      const installedOn = new Date(ahu.InstalledOn);
      const cleaningFreq = ahu.cleaningFreqAllowance || 0;
      const cleaningDays = ahu.cleaningdays || 0;

      // Check if already scheduled today
      const checkResult = await pool.request()
        .input('FilterId', sql.Int, ahuId)
        .input('ScheduledDate', sql.Date, todayDate)
        .query(`
          SELECT COUNT(*) AS count FROM RNDAdmin.AHUCleaningSchedule
          WHERE FilterId = @FilterId AND ScheduledDate = @ScheduledDate
        `);

      if (checkResult.recordset[0].count > 0) {
        continue;
      }

      // Get last schedule
      const lastScheduleResult = await pool.request()
        .input('FilterId', sql.Int, ahuId)
        .query(`
          SELECT TOP 1 ScheduledDate FROM RNDAdmin.AHUCleaningSchedule
          WHERE FilterId = @FilterId
          ORDER BY ScheduledDate DESC
        `);

      if (lastScheduleResult.recordset.length > 0) {
        const lastScheduled = new Date(lastScheduleResult.recordset[0].ScheduledDate);
        const nextDue = new Date(lastScheduled);
        nextDue.setDate(nextDue.getDate() + cleaningDays);

        const startDate = new Date(nextDue);
        startDate.setDate(startDate.getDate() - cleaningFreq);
        const endDate = new Date(nextDue);
        endDate.setDate(endDate.getDate() + cleaningFreq);

        if (todayDate >= startDate && todayDate <= endDate) {
          await pool.request()
            .input('FilterId', sql.Int, ahuId)
            .input('ScheduledDate', sql.Date, todayDate)
            .query(`
              INSERT INTO RNDAdmin.AHUCleaningSchedule (FilterId, ScheduledDate)
              VALUES (@FilterId, @ScheduledDate)
            `);
          inserted.push({ FilterId: ahuId, ScheduledDate: todayDate.toISOString().split('T')[0] });
        }
      } else {
        // No schedule yet → use installed date ± allowance
        const startDate = new Date(installedOn);
        startDate.setDate(startDate.getDate() - cleaningFreq);
        const endDate = new Date(installedOn);
        endDate.setDate(endDate.getDate() + cleaningFreq);

        if (todayDate >= startDate && todayDate <= endDate) {
          await pool.request()
            .input('FilterId', sql.Int, ahuId)
            .input('ScheduledDate', sql.Date, todayDate)
            .query(`
              INSERT INTO RNDAdmin.AHUCleaningSchedule (FilterId, ScheduledDate)
              VALUES (@FilterId, @ScheduledDate)
            `);
          inserted.push({ FilterId: ahuId, ScheduledDate: todayDate.toISOString().split('T')[0] });
        }
      }
    }

    res.json({
      message: `${inserted.length} schedule(s) inserted.`,
      inserted: inserted,
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Internal server error');
  } finally {
    if (pool) {
      await pool.close();
    }
  }
});

// app.get('/api/printLabel', (req, res) => {
//   const { ip, barcode_number, label_text } = req.query;

//   if (!ip || !barcode_number || !label_text) {
//     return res.status(400).json({ success: false, message: 'Missing required fields' });
//   }

// //   const zpl = `
// // ^XA
// // ^FO50,30^ADN,36,20^FD${label_text}^FS
// // ^FO50,80^BY2
// // ^BCN,100,Y,N,N
// // ^FD${barcode_number}^FS
// // ^XZ
// // `;
// const zpl = `
// ^XA
// ^PW812
// ^LL406
// ^LH0,0

// ^FO290,30^ADN,36,20^FD${label_text}^FS        ; Moved left by 20 dots
// ^FO290,80^BY2
// ^BCN,100,Y,N,N
// ^FD${barcode_number}^FS
// ^XZ
// `;

//   const client = new net.Socket();

//   client.connect(9100, ip, () => {
//     client.write(zpl);
//     client.end();
//     res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
//   });

//   client.on('error', (err) => {
//     res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
//   });
// });


//region working
// app.get('/api/printLabel', (req, res) => {
//   const { ip, barcode_number, label_text } = req.query;

//   if (!ip || !barcode_number || !label_text) {
//     return res.status(400).json({ success: false, message: 'Missing required fields' });
//   }

//   const maxCharsPerLine = 9;
//   let line1 = label_text.slice(0, maxCharsPerLine);
//   let line2 = label_text.length > maxCharsPerLine ? label_text.slice(maxCharsPerLine) : '';

//   // Label width in dots for 2"
//   const labelWidth = 406;
//   const charWidth = 10; // Approx width per char with ADN,18,10

//   // Center X position for text
//   const calcX = (text) => Math.floor((labelWidth - (text.length * charWidth)) / 2);

//   const zpl = `
// ^XA
// ^PW406
// ^LL406
// ^LH0,0

// ^FO${calcX(line1)},30^ADN,18,10^FD${line1}^FS
// ${line2 ? `^FO${calcX(line2)},60^ADN,18,10^FD${line2}^FS` : ''}

// ^FO${Math.floor((406 - 200) / 2)},120^BY2
// ^BCN,80,Y,N,N
// ^FD${barcode_number}^FS

// ^XZ
// `;

//   const client = new net.Socket();

//   client.connect(9100, ip, () => {
//     client.write(zpl);
//     client.end();
//     res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
//   });

//   client.on('error', (err) => {
//     res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
//   });
// });

//region working but smaller font 
// app.get('/api/printLabel', (req, res) => {
//   const { ip, barcode_number, label_text } = req.query;

//   if (!ip || !barcode_number || !label_text) {
//     return res.status(400).json({ success: false, message: 'Missing required fields' });
//   }

//   // Wrap long label text into lines of 13 characters
//   const maxCharsPerLine = 18;
//   const lines = [];
//   for (let i = 0; i < label_text.length; i += maxCharsPerLine) {
//     lines.push(label_text.slice(i, i + maxCharsPerLine));
//   }

//   const labelWidth = 366;
//   const charWidth = 14; // ADN,28,14
//   const labelHeight = 280;

//   const calcX = (text) => Math.floor((labelWidth - (text.length * charWidth)) / 2);

//   let zpl = `
// ^XA
// ^PW${labelWidth}
// ^LL${labelHeight}
// ^LH0,0
// `;

//   // Text lines
//   lines.forEach((line, index) => {
//     const y = 10 + index * 30;
//     zpl += `^FO${calcX(line)},${y}^ADN,28,14^FD${line}^FS\n`;
//   });

//   // Barcode starts below last text line
//   const barcodeY = 10 + lines.length * 30 + 10;

//   zpl += `
// ^FO50,${barcodeY}^BY2,2,60
// ^BCN,60,Y,N,N
// ^FD${barcode_number}^FS
// ^XZ
// `;

//   const client = new net.Socket();

//   client.connect(9100, ip, () => {
//     client.write(zpl);
//     client.end();
//     res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
//   });

//   client.on('error', (err) => {
//     res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
//   });
// });

//region best so far
// app.get('/api/printLabel', (req, res) => {
//   const { ip, barcode_number, label_text } = req.query;

//   if (!ip || !barcode_number || !label_text) {
//     return res.status(400).json({ success: false, message: 'Missing required fields' });
//   }

//   const maxCharsPerLine = 16;
//   const lines = [];
//   for (let i = 0; i < label_text.length; i += maxCharsPerLine) {
//     lines.push(label_text.slice(i, i + maxCharsPerLine));
//   }

//   const labelWidth = 366;
//   const labelHeight = 260;
//   const charWidth = 10; // ADN,20,10 = ~10 dots wide per char
//   const topPadding = 45;

//   const calcX = (text) => Math.floor((labelWidth - (text.length * charWidth)) / 2);

//   let zpl = `
// ^XA
// ^PW${labelWidth}
// ^LL${labelHeight}
// ^LH0,0
// `;

//   // Render each line of label text
//   lines.forEach((line, index) => {
//     const y = topPadding + index * 30;
//     zpl += `^FO${calcX(line)},${y}^ADN,20,10^FD${line}^FS\n`;
//   });

//   // Barcode position after text
//   const barcodeY = topPadding + lines.length * 30 + 5;

//   zpl += `
// ^FO50,${barcodeY}^BY3,3,100
// ^BCN,100,Y,N,N
// ^FD${barcode_number}^FS
// ^XZ
// `;

//   const client = new net.Socket();

//   client.connect(9100, ip, () => {
//     client.write(zpl);
//     client.end();
//     res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
//   });

//   client.on('error', (err) => {
//     res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
//   });
// });


//region best so far 2
// app.get('/api/printLabel', (req, res) => {
//   const { ip, barcode_number, label_text } = req.query;

//   if (!ip || !barcode_number || !label_text) {
//     return res.status(400).json({ success: false, message: 'Missing required fields' });
//   }

//   const maxCharsPerLine = 16;
//   const lines = [];
//   for (let i = 0; i < label_text.length; i += maxCharsPerLine) {
//     lines.push(label_text.slice(i, i + maxCharsPerLine));
//   }

//   const labelWidth = 366;
//   const labelHeight = 260;
//   const charWidth = 10; // ADN,20,10 = ~10 dots wide per char
//   const topPadding = 85;

//   const calcX = (text) => Math.floor((labelWidth - (text.length * charWidth)) / 2);

//   let zpl = `
// ^XA
// ^PW${labelWidth}
// ^LL${labelHeight}
// ^LH0,0
// `;

//   // Render each line of label text
//   lines.forEach((line, index) => {
//     const y = topPadding + index * 30;
//     zpl += `^FO${calcX(line)},${y}^ADN,20,10^FD${line}^FS\n`;
//   });

//   // Barcode position after text
//   const barcodeY = topPadding + lines.length * 30 + 5;

// zpl += `
// ^FO20,${barcodeY}^BY3,3,100
// ^BCN,100,Y,N,N
// ^FD${barcode_number}^FS
// ^XZ
// `;

//   const client = new net.Socket();

//   client.connect(9100, ip, () => {
//     client.write(zpl);
//     client.end();
//     res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
//   });

//   client.on('error', (err) => {
//     res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
//   });
// });


//region perfect 
// app.get('/api/printLabel', (req, res) => {
//   const { ip, barcode_number, label_text } = req.query;

//   if (!ip || !barcode_number || !label_text) {
//     return res.status(400).json({ success: false, message: 'Missing required fields' });
//   }

//   // Adjusted values
//   const labelWidth = 406;   // Increased from 366
//   const labelHeight = 350;  // Increased from 260
//   const maxCharsPerLine = 14; // Reduced from 16
//   const charWidth = 10;
//   const topPadding = 85;
//   const lineSpacing = 35;

//   const lines = [];
//   for (let i = 0; i < label_text.length; i += maxCharsPerLine) {
//     lines.push(label_text.slice(i, i + maxCharsPerLine));
//   }

//   const calcX = (text) => Math.floor((labelWidth - (text.length * charWidth)) / 2);

//   let zpl = `^XA
// ^PW${labelWidth}
// ^LL${labelHeight}
// ^LH0,0
// `;

//   lines.forEach((line, index) => {
//     const y = topPadding + index * lineSpacing;
//     zpl += `^FO${calcX(line)},${y}^ADN,20,10^FD${line}^FS\n`;
//   });

//   const barcodeY = topPadding + lines.length * lineSpacing + 10;

//   zpl += `^FO20,${barcodeY}^BY3,3,100
// ^BCN,100,Y,N,N
// ^FD${barcode_number}^FS
// ^XZ`;

//   const client = new net.Socket();

//   client.connect(9100, ip, () => {
//     client.write(zpl);
//     client.end();
//     res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
//   });

//   client.on('error', (err) => {
//     res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
//   });
// });



// host = '0.0.0.0'

// sql.connect(dbConfig).then(() => {
//   app.listen(8080,host, () => console.log("Server running on port 8080 : http://localhost:8080/api-docs"));
// }).catch(err => console.log("DB Connection failed:", err));

app.get('/api/printLabel', (req, res) => {
  const { ip, barcode_number, label_text } = req.query;

  // Validate required fields
  if (!ip || !barcode_number || !label_text) {
    return res.status(400).json({
      success: false,
      message: '❌ Missing required fields: ip, barcode_number, label_text',
    });
  }

  // === Label Setup for 2" x 2" at 203 DPI ===
  const labelWidth = 406;          // 2 inches wide
  const labelHeight = 406;         // 2 inches tall
  const maxCharsPerLine = 15;      // Wrapping threshold
  const charWidth = 11;            // Width of a character in dots
  const fontHeight = 25;           // Font height in dots
  const fontWidth = 15;            // Font width in dots
  const topPadding = 70;           // Y-offset for first line
  const lineSpacing = 28;          // Space between lines
  const leftMargin = 20;           // Reduced left margin (was centered before)

  // === Wrap Text into Lines ===
  const lines = [];
  for (let i = 0; i < label_text.length; i += maxCharsPerLine) {
    lines.push(label_text.slice(i, i + maxCharsPerLine));
  }

  // === Generate ZPL ===
  let zpl = `^XA
^PW${labelWidth}
^LL${labelHeight}
^LH0,0
`;

  lines.forEach((line, index) => {
    const y = topPadding + index * lineSpacing;
    zpl += `^FO${leftMargin},${y}^ADN,${fontHeight},${fontWidth}^FD${line}^FS\n`;
  });

  // Barcode just below text
  const barcodeY = topPadding + lines.length * lineSpacing + 10;

  zpl += `
^FO${leftMargin},${barcodeY}
^BY3,3,100
^BCN,100,Y,N,N
^FD${barcode_number}^FS
^XZ`;

  // === Send to Zebra Printer ===
  const client = new net.Socket();

  client.connect(9100, ip, () => {
    client.write(zpl);
    client.end();
    res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
  });

  client.on('error', (err) => {
    res.status(500).json({
      success: false,
      message: '❌ Failed to send print job',
      error: err.message,
    });
  });
});

sql.connect(dbConfig).then(() => {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}).catch(err => {
  console.log("DB Connection failed:", err);
});