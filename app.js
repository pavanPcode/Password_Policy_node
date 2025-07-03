const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const cors = require("cors"); // ✅ Import CORS
const screenRoutes = require("./server");

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

const getPolicy = async () => {
  try {
    const result = await sql.query`SELECT TOP 1 * FROM psw.PasswordPolicy`;
    const row = result.recordset[0];
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

const validatePassword = (password, policy) => {
  if (password.length <= policy.MinLength-1)
    return [false, `Password must be at least ${policy.MinLength} characters`];
  if (policy.RequireUppercase && !/[A-Z]/.test(password))
    return [false, "Must include an uppercase letter"];
  if (policy.RequireLowercase && !/[a-z]/.test(password))
    return [false, "Must include a lowercase letter"];
  if (policy.RequireDigit && !/\d/.test(password))
    return [false, "Must include a digit"];
  if (policy.RequireSpecialChar && !/[\W_]/.test(password))
    return [false, "Must include a special character"];
  return [true, "Valid"];
};


function generateRandomPassword(policy) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '@';
  let allChars = '';
  let password = '';

  if (policy.RequireUppercase) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    allChars += uppercase;
  }

  if (policy.RequireLowercase) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    allChars += lowercase;
  }

  if (policy.RequireDigit) {
    password += digits[Math.floor(Math.random() * digits.length)];
    allChars += digits;
  }

  if (policy.RequireSpecialChar) {
    password += special[Math.floor(Math.random() * special.length)];
    allChars += special;
  }

  // Fill the rest with random characters up to MinLength
  while (password.length < policy.MinLength) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

app.post("/register", async (req, res) => {
  try {
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
    const { username, password } = req.body;
    const policy = await getPolicy();

    const result = await sql.query`
      SELECT u.UserID, u.PasswordHash, s.FailedLoginAttempts, s.IsLocked,
             s.PasswordExpiryDate, s.LastFailedAttempt,s.isTemporaryPassword,u.Role,u.Name,  (SELECT TOP 1 sessionTimeoutMinutes FROM psw.PasswordPolicy) AS sessionTimeoutMinutes

      FROM dbo.pereco_Users u
      JOIN psw.UserSecurity s ON u.UserID = s.UserID
      WHERE u.Email = ${username}`;

    const row = result.recordset[0];
    if (!row) return res.status(404).json({ Message: "User not found", status: false, ResultData: [] });

    let { UserID, PasswordHash, FailedLoginAttempts, IsLocked, PasswordExpiryDate, LastFailedAttempt,isTemporaryPassword,Role,Name,sessionTimeoutMinutes } = row;

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
      return res.json({ Message: "Login successful", status: true, ResultData: {UserID:UserID,isTemporaryPassword:isTemporaryPassword,Role:Role,Name:Name,sessionTimeoutMinutes:sessionTimeoutMinutes} });
    } else {
      FailedLoginAttempts += 1;
      const isLocked = FailedLoginAttempts >= policy.MaxFailedAttempts ? 1 : 0;
      await sql.query`UPDATE psw.UserSecurity SET FailedLoginAttempts = ${FailedLoginAttempts}, IsLocked = ${isLocked}, LastFailedAttempt = GETDATE() WHERE UserID = ${UserID}`;
      if (isLocked)
        // return res.status(403).json({ Message: `Account is locked due to too many failed attempts. Try again after ${policy.LockoutDurationMinutes} minutes.`, status: false, ResultData: [] });
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
    const result = await sql.query`SELECT TOP 1 * FROM psw.PasswordPolicy`;
    const row = result.recordset[0];

    if (!row) return res.status(404).json({ error: "No password policy configured.", status: false, ResultData: [] });

    res.json({ error: "", status: false, ResultData: row });
  } catch (e) {
    console.log("Policy fetch error:", e);
    res.status(500).json({ error: "Failed to fetch password policy.", status: false, ResultData: [] });
  }
});

// app.post('/addActivity', async (req, res) => {
//   try {
//     const { ActivityType, PerformedBy, PerformedOn, Notes, Location } = req.body;

//     if (!ActivityType || !PerformedBy || !PerformedOn) {
//       return res.status(400).json({ message: 'Missing required fields', status: false, ResultData: []  });
//     }

//     const safeNotes = Notes || '';
//     const safeLocation = Location || '';

//     await sql.connect(dbConfig);
//     await sql.query`
//       INSERT INTO [dbo].[pereco_ActivityLog] (ActivityType, PerformedBy, PerformedOn, Notes, Location)
//       VALUES (${ActivityType}, ${PerformedBy}, ${PerformedOn}, ${safeNotes}, ${safeLocation})
//     `;

//     res.json({ message: 'Activity inserted successfully', status: true, ResultData: []  });
//   } catch (error) {
//     console.error('Insert error:', error.message, error);  // Updated for better logs
//     res.status(500).json({ message: 'Failed to insert activity', status: false, ResultData: []  });
//   }
// });

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


app.post('/addActivity', async (req, res) => {
  try {
    const { ActivityType, PerformedBy, Notes, Location } = req.body;

    const result = await addActivityLog(
      ActivityType,
      PerformedBy,
      Notes || '',
      Location || ''
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }

    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

'---------------------------------------------------'

app.get('/GetAHUMachines', async (req, res) => {
  try {
    // let ActivityType = '1';
    // let PerformedBy = '2';
    // let Notes = 'GetAHUMachines';
    // let Location = '';
    const result = await addActivityLog('1','2','GetAHUMachines' ,'');

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
    const result = await addActivityLog('2','2','AddAHUMachines' ,'');

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
    const result = await addActivityLog('3','2','EditAHUMachines' ,'');

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
    const result = await addActivityLog('4','2','DeleteAHUMachines' ,'');

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
    const result = await addActivityLog('5','2','DeleteAHUFilters' ,'');

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
    const result = await addActivityLog('6','2','EditAHUFilters' ,'');

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
    const result = await addActivityLog('7','2','AddAHUFilters' ,'');

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
    const result = await addActivityLog('8','2','GetAHUFilters' ,'');

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
    const result = await addActivityLog('9','2','AHUFiltersUpdateStatus' ,'');

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
    const result = await addActivityLog('10','2','AHUFilterGenerateBarcode' ,'');

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
    const result = await addActivityLog('11','2','getNotifications' ,'');

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
    const result = await addActivityLog('12','2','AuditTrial' ,'');

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
    const result = await addActivityLog('13','2','Schedule' ,'');

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
    const result = await addActivityLog('14','2','getDeviationsAlarms' ,'');

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
    const result = await addActivityLog('15','2','getReplacementList' ,'');

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
    const result = await addActivityLog('16','2','getRetirementList' ,'');

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
    const result = await addActivityLog('17','2','getUser' ,'');

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
    const result = await addActivityLog('18','2','AddUser' ,'');

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
    const result = await addActivityLog('19','2','EditUser' ,'');

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
    const result = await addActivityLog('21','2','getRolePermissions' ,'');

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
    const result = await addActivityLog('22','2','getFilterTypes' ,'');

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
    const result = await addActivityLog('21','2','addFilterTypes' ,'');

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
    const result = await addActivityLog('22','2','editFilterTypes' ,'');

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
    const result = await addActivityLog('23','2','deleteFilterTypes' ,'');

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
    const result = await addActivityLog('24','2','getDashboard' ,'');

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
    const result = await addActivityLog('25','2','getSidebar' ,'');

    if (!result.success) {
      return res.status(400).json({ message: result.message, status: false, ResultData: [] });
    }
    res.json({ message: result.message, status: true, ResultData: [] });
  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ message: 'Internal server error', status: false, ResultData: [] });
  }
});

host = '0.0.0.0'

sql.connect(dbConfig).then(() => {
  app.listen(8080,host, () => console.log("Server running on port 3000"));
}).catch(err => console.log("DB Connection failed:", err));

