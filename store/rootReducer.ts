import { combineReducers } from '@reduxjs/toolkit'
import uiReducer from '@/features/ui/uiSlice'
import templatesReducer from '@/features/templates/templatesSlice'
import componentBlocksReducer from '@/features/componentBlocks/componentBlocksSlice'
import usersReducer from '@/features/users/usersSlice'
import customerListsReducer from '@/features/customers/customerListsSlice'

export const rootReducer = combineReducers({
  ui: uiReducer,
  templates: templatesReducer,
  componentBlocks: componentBlocksReducer,
  users: usersReducer,
  customerLists: customerListsReducer,
})

export default rootReducer
