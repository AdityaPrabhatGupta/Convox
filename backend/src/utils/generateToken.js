import { signAccessToken } from "./tokens.js";

const generateToken = (userId, name) =>
  signAccessToken({
    _id: userId,
    name,
  });

export default generateToken;
