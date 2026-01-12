import { combineReducers } from '@reduxjs/toolkit'
import uiReducer from '@/features/ui/uiSlice'
import templatesReducer from '@/features/templates/templatesSlice'
import componentBlocksReducer from '@/features/componentBlocks/componentBlocksSlice'

export const rootReducer = combineReducers({
  ui: uiReducer,
  templates: templatesReducer,
  componentBlocks: componentBlocksReducer,
})

export default rootReducer
