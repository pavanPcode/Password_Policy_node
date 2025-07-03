const express = require("express");
const dbUtility = require("./dbUtility.js");
const { OperationEnums } = require("./utilityEnum.js");

// const app = express();
const router = express.Router();
// const cors = require("cors");
// const port = process.env.PORT || 3080;

// app.use(cors());
// app.use(express.json());
// app.use("/api", router);

const executeStoredProcedure = (req, res, data, operationId) => {
  const jsonData = JSON.stringify(data);
  const sqlQuery = `
          DECLARE @ResultMessage NVARCHAR(MAX);
          DECLARE @STATUS NVARCHAR(MAX); 
          EXEC [dbo].[SP_ScreenOperations]
              @OperationId = '${operationId}',
              @JsonData = '${jsonData}',
              @ResultMessage = @ResultMessage OUTPUT,
              @STATUS = @STATUS OUTPUT; 
          SELECT @ResultMessage AS ResultMessage, @STATUS AS Status; 
      `;

  console.log(sqlQuery);
  dbUtility
    .executeQuery(sqlQuery)
    .then((results) => handleResponse(res, null, results))
    .catch((error) => handleResponse(res, error, null));
};

const handleResponse = (res, error, results) => {
  if (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } else if (results && results.length > 0) {
    res.json({ ResultData: results, Status: true });
  } else {
    res.status(200).json({ error: "No records found", Status: false });
  }
};

const handleRecord = (req, res, data, operationId) => {
  executeStoredProcedure(req, res, data, operationId);
};

//region Filter types
router.get("/getFilterTypes", (req, res) => {
  const data = {};
  handleRecord(req, res, data, OperationEnums().GETFILTERTYPES);
});

router.post("/addFilterType", async (req, res) => {
  const data = { ...req.body };
  handleRecord(req, res, data, OperationEnums().ADDFILTERTYPE);
});

router.post("/updateFilterType", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEFILTERTYPE);
});

router.post("/updateFilterTypeStatus", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEFILTERTYPESTATUS);
});

//region AHU
router.get("/getAhuList", (req, res) => {
  const data = {};
  handleRecord(req, res, data, OperationEnums().GETAHULIST);
});

router.post("/addAhu", async (req, res) => {
  const data = { ...req.body };
  handleRecord(req, res, data, OperationEnums().ADDAHU);
});

router.post("/updateAhu", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEAHU);
});

router.post("/updateAhuIsActive", async (req, res) => {
  const data = req.body;
  handleRecord(req, res, data, OperationEnums().UPDATEAHUISACTIVE);
});

//region Users
router.get("/getUsers", (req, res) => {
  const data = {};
  handleRecord(req, res, data, OperationEnums().GETUSERS);
});

// app.listen(port, () => {
//   console.log(`services running on port ${port}`);
// });

module.exports = router;
