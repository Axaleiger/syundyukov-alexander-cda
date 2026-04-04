// Адаптер для будущего приема JSON от Python/sklearn.
// Ожидает дерево и правила в формате, близком к результату _parse_tree/_clean_rules.

export function fromPythonTreeJson(treeJson, ruleJson) {
  if (!treeJson) {
    return { tree: null, rule: {} }
  }

  const rule = ruleJson || {}

  // Сейчас просто возвращаем как есть, предполагая, что сервер уже отдает нужный формат.
  // Здесь можно добавить нормализацию структуры по мере необходимости.
  return { tree: treeJson, rule }
}

