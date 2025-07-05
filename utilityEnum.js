function OperationEnums() {
  const Operations = {
    GETFILTERTYPES: 1,
    ADDFILTERTYPE: 2,
    UPDATEFILTERTYPE: 3,
    UPDATEFILTERTYPESTATUS: 4,
    GETAHULIST: 17,
    ADDAHU: 18,
    UPDATEAHU: 19,
    UPDATEAHUISACTIVE: 20,
    GETUSERS: 21,
    GETBCTYPE: 25,
    AddAHUFilter:200,
    getAHUId:201,
    getFilterType:202,
    getLocationType:203,
  };
  return Operations;
}
module.exports = {
  OperationEnums,
};
