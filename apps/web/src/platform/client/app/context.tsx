import { createSlice } from "@reduxjs/toolkit";

const platformState = createSlice({
  name: "platform",
  /**
   * Context related to the platform
   */
  initialState: {
    language: "en",
  },
  reducers: {
    changeLanguage: (state, action) => {
      state.language = action.payload;
    },
  },
});

export const { changeLanguage } = platformState.actions;
export default platformState.reducer;
