import IncomeLevel from "../models/incomeLevel.js";

const addNewLevel = async (req, res) => {
  try {
    const { levelName, left, right, price } = req.body;
    if (!levelName || !left || !right || !price) {
      return res.status(400).json({
        error: "required MissingField",
        message: {
          levelName: !levelName ? "levelName is required" : undefined,
          left: !left ? "left is required" : undefined,
          right: !right ? "right is required" : undefined,
          price: !price ? "price is required" : undefined,
        },
      });
    }
    const existLevel = await IncomeLevel.findOne({ levelName });
    if (existLevel) {
      return res
        .status(409)
        .json({ message: `This ${levelName} already exist` });
    }
    const newLevel = new IncomeLevel({ levelName, left, right, price });
    await newLevel.save();

    res.status(201).json({ message: "new Level create successful" });
  } catch (error) {
    console.error("addNewLevel Error", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAllLevel = async (req, res) => {
  try {
    const existLevel = await IncomeLevel.find({});
    if (!existLevel || existLevel.length === 0) {
      return res.status(400).json({ message: "Not Exist Any Level in DB" });
    }
    res.status(200).json({ message: "get all Level", level: existLevel });
  } catch (error) {
    console.error("getAllLevel Error", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export { addNewLevel, getAllLevel };
