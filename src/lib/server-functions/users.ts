import { createServerFn } from "@tanstack/react-start";
import User from "@/models/user";

const getAllUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<User.EncodedT[]> => {
    return await User.API.getAll();
  }
);

export { getAllUsers };
