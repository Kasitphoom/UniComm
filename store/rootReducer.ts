import { combineReducers } from '@reduxjs/toolkit'
import uiReducer from '@/features/ui/uiSlice'
import templatesReducer from '@/features/templates/templatesSlice'

export const rootReducer = combineReducers({
  ui: uiReducer,
  templates: templatesReducer,
})

export default rootReducer
