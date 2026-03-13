import type { Option } from "./lib/option";
import type Clinic from "./models/clinic";
import type Device from "./models/device";
import type User from "./models/user";

/**
 * The Caller that made a request.
 * Contains the user information, their token and the device they called from - all derived from the database based on the requests
 */
export type RequestCaller =
  | {
      user: User.EncodedT;
      clinic: Option<Clinic.EncodedT>; // There is a slight chance that the user has no clinic
      token: string;
    }
  | {
      // This is for trusted devices like servers and/or local sync_hubs
      device: Device.Table.Devices;
    };
