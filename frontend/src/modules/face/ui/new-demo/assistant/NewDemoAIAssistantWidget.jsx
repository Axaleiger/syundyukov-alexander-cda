import AIAssistantWidget from "../../../../ai/ui/AIAssistantWidget"

/**
 * ИИ-помощник new-demo стенда: та же логика, что и на /face (classic), оформление из NewDemoAIAssistantWidget.module.css.
 */
export default function NewDemoAIAssistantWidget(props) {
	return <AIAssistantWidget {...props} appearance="newDemo" />
}
