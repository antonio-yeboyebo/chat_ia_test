import { IaRuntimeProvider } from './runtime/IaRuntimeProvider'
import { Chat } from './components/Chat'

export default function App() {
  return (
    <IaRuntimeProvider>
      <Chat />
    </IaRuntimeProvider>
  )
}
