import User from "../models/User.js";

export const searchUsers = async (req, res) => {
  try {
    const { keyword } = req.query;
    const currentUserId = req.user._id;

    if (!keyword || keyword.trim() === "") {
      return res.status(200).json([]);
    }

    const regex = new RegExp(keyword.trim(), "i");

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [{ name: regex }, { email: regex }],
    })
      .select("_id name email profilePic")
      .limit(10);

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

