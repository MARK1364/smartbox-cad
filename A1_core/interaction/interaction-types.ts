export enum IntentType {
    CANCEL = "CANCEL",
    CONFIRM = "CONFIRM",
    SELECT = "SELECT",
    CONTEXT_MENU = "CONTEXT_MENU",
    DELETE = "DELETE",
    // Dodatkowe intencje można dodawać tutaj w przyszłości
}

export interface Intent {
    type: IntentType;
    pointerInfo?: any; // Dodatkowe informacje z myszy
    keyboardInfo?: any; // Dodatkowe informacje z klawiatury
}
