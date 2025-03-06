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
    res.status(201).json({ message: "new Level create successful" });
  } catch (error) {
    console.error("addNewLevel Error", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export { addNewLevel };
