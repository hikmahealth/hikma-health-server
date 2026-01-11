import { Action, configureStore, ThunkAction } from "@reduxjs/toolkit";
import platformReducer from "./context";

export const store = configureStore({
  reducer: {
    platform: platformReducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>;
