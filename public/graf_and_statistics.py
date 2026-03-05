import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
import matplotlib.patches as mpatches
import numpy as np
import warnings
import os

warnings.filterwarnings('ignore')

# Настройки для лучшего отображения
plt.rcParams['figure.figsize'] = [16, 12]
plt.rcParams['font.size'] = 10


# ===================== 1. ЗАГРУЗКА И ПОДГОТОВКА ДАННЫХ =====================

def load_and_prepare_data(file_path):
    """
    Загружает данные из Excel и подготавливает их для построения графа
    """
    try:
        # Проверяем существование файла
        if not os.path.exists(file_path):
            print(f"✗ Ошибка: Файл не найден по пути {file_path}")
            print(f"   Проверьте правильность пути и имя файла")
            return None

        # Чтение Excel файла
        df = pd.read_excel(file_path)

        print("✓ Файл успешно загружен")
        print(f"✓ Размер таблицы: {df.shape[0]} строк, {df.shape[1]} столбцов")
        print("\nСтолбцы в файле:")
        for i, col in enumerate(df.columns.tolist(), 1):
            print(f"  {i:2d}. {col}")

        # Выбираем только нужные столбцы для графа
        columns_for_graph = [
            'Этап Название',
            'Карточка Название',
            'Исполнитель',
            'Используемые системы',
            'Входные данные',
            'Выходные данные'
        ]

        # Проверяем наличие всех столбцов
        available_columns = df.columns.tolist()
        missing_columns = [col for col in columns_for_graph if col not in available_columns]

        if missing_columns:
            print(f"\n⚠ Внимание! Отсутствуют необходимые столбцы: {missing_columns}")
            print("\nДоступные столбцы:")
            for i, col in enumerate(available_columns, 1):
                print(f"  {i:2d}. {col}")

            # Пытаемся найти похожие названия столбцов
            print("\nПоиск похожих столбцов...")
            for missing in missing_columns:
                similar = [col for col in available_columns if
                           missing.lower() in col.lower() or col.lower() in missing.lower()]
                if similar:
                    print(f"  Для '{missing}' найдены похожие: {similar}")

            return None

        df_graph = df[columns_for_graph].copy()

        # Преобразуем все значения в строки и очищаем от лишних пробелов
        for col in df_graph.columns:
            df_graph[col] = df_graph[col].astype(str).str.strip()
            # Заменяем 'nan' на пустую строку
            df_graph[col] = df_graph[col].replace('nan', '')

        print(f"\n✓ Выбрано {len(columns_for_graph)} столбцов для графа")
        print(f"✓ Количество уникальных значений по столбцам:")
        for col in columns_for_graph:
            non_empty = df_graph[col][df_graph[col] != '']
            unique_count = non_empty.nunique()
            total_count = len(non_empty)
            print(f"  - {col}: {unique_count} уникальных из {total_count} заполненных")

        # Показываем первые несколько строк для проверки
        print("\n✓ Первые 3 строки данных для графа:")
        print(df_graph.head(3).to_string())

        return df_graph

    except Exception as e:
        print(f"✗ Ошибка при загрузке файла: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return None


# ===================== 2. ПОСТРОЕНИЕ ГРАФА =====================

def build_graph(df):
    """
    Строит граф связей между параметрами
    """
    # Создаем граф
    G = nx.Graph()

    # Цвета для разных типов узлов
    node_colors = {
        'Этап Название': '#FF6B6B',  # Красный
        'Карточка Название': '#4ECDC4',  # Бирюзовый
        'Исполнитель': '#FFD166',  # Желтый
        'Используемые системы': '#06D6A0',  # Зеленый
        'Входные данные': '#118AB2',  # Синий
        'Выходные данные': '#7209B7'  # Фиолетовый
    }

    # Словарь для хранения узлов и их типов
    node_types = {}

    print("\n" + "=" * 60)
    print("ПОСТРОЕНИЕ ГРАФА")
    print("=" * 60)

    # Счетчики для статистики
    rows_processed = 0
    connections_created = 0

    # Проходим по каждой строке данных
    for idx, row in df.iterrows():
        rows_processed += 1

        # Получаем значения для всех столбцов
        values = {
            'Этап Название': row['Этап Название'],
            'Карточка Название': row['Карточка Название'],
            'Исполнитель': row['Исполнитель'],
            'Используемые системы': row['Используемые системы'],
            'Входные данные': row['Входные данные'],
            'Выходные данные': row['Выходные данные']
        }

        # Фильтруем пустые значения
        non_empty_values = {k: v for k, v in values.items() if v and str(v).strip() != ''}

        # Добавляем узлы и определяем их тип
        for col_name, value in non_empty_values.items():
            node_id = f"{col_name}: {value}"
            if node_id not in G:
                G.add_node(node_id)
                node_types[node_id] = col_name

        # Создаем связи между всеми параметрами в строке
        nodes_in_row = [f"{col_name}: {non_empty_values[col_name]}" for col_name in non_empty_values]

        # Добавляем связи между всеми узлами в строке
        for i in range(len(nodes_in_row)):
            for j in range(i + 1, len(nodes_in_row)):
                if not G.has_edge(nodes_in_row[i], nodes_in_row[j]):
                    G.add_edge(nodes_in_row[i], nodes_in_row[j])
                    connections_created += 1

    print(f"\n✓ Обработано строк: {rows_processed}")
    print(f"✓ Граф построен успешно!")
    print(f"  - Всего узлов: {G.number_of_nodes()}")
    print(f"  - Всего связей: {G.number_of_edges()}")
    print(f"  - Уникальных связей создано: {connections_created}")

    return G, node_types, node_colors


# ===================== 3. ВИЗУАЛИЗАЦИЯ ГРАФА =====================

def visualize_graph(G, node_types, node_colors):
    """
    Визуализирует граф с цветовой кодировкой
    """
    print("\n" + "=" * 60)
    print("ВИЗУАЛИЗАЦИЯ ГРАФА")
    print("=" * 60)

    if G.number_of_nodes() == 0:
        print("✗ Граф не содержит узлов для визуализации")
        return None, None

    # Создаем массив цветов для узлов
    node_color_list = []
    node_sizes = []

    for node in G.nodes():
        node_type = node_types.get(node, 'Unknown')
        node_color_list.append(node_colors.get(node_type, '#808080'))
        # Размер узла зависит от количества связей
        degree = G.degree(node)
        node_sizes.append(100 + degree * 20)

    # Рассчитываем позиции узлов
    print("⏳ Расчет позиций узлов...")

    # Используем разные layout'ы в зависимости от размера графа
    if G.number_of_nodes() < 50:
        pos = nx.spring_layout(G, k=2, iterations=100, seed=42)
    elif G.number_of_nodes() < 200:
        pos = nx.spring_layout(G, k=1.5, iterations=80, seed=42)
    else:
        pos = nx.spring_layout(G, k=1, iterations=60, seed=42)

    # Создаем фигуру
    fig, ax = plt.subplots(figsize=(20, 16))

    print("⏳ Отрисовка графа...")

    # Рисуем граф
    nx.draw_networkx_edges(
        G, pos,
        alpha=0.2,
        edge_color='gray',
        width=0.8,
        ax=ax
    )

    # Рисуем узлы с разными размерами
    nx.draw_networkx_nodes(
        G, pos,
        node_color=node_color_list,
        node_size=node_sizes,
        alpha=0.85,
        edgecolors='white',
        linewidths=1.5,
        ax=ax
    )

    # Добавляем подписи к узлам
    labels = {}
    for node in G.nodes():
        # Берем только значение (без префикса типа)
        node_value = node.split(": ", 1)[1] if ": " in node else node
        # Ограничиваем длину для читаемости
        if len(node_value) > 25:
            labels[node] = node_value[:22] + "..."
        else:
            labels[node] = node_value

    nx.draw_networkx_labels(
        G, pos, labels,
        font_size=9,
        font_weight='bold',
        font_family='sans-serif',
        ax=ax
    )

    # Создаем легенду
    print("⏳ Создание легенды...")
    legend_patches = []
    for node_type, color in node_colors.items():
        # Считаем количество узлов этого типа
        count = sum(1 for n_type in node_types.values() if n_type == node_type)
        patch = mpatches.Patch(
            color=color,
            label=f"{node_type} ({count} узлов)",
            alpha=0.8
        )
        legend_patches.append(patch)

    # Добавляем легенду
    ax.legend(
        handles=legend_patches,
        loc='upper left',
        bbox_to_anchor=(1.05, 1),
        fontsize=11,
        framealpha=0.9,
        title="Типы узлов",
        title_fontsize=12
    )

    # Добавляем заголовок и статистику
    plt.title(
        f'Граф связей между параметрами проектов\n'
        f'Всего узлов: {G.number_of_nodes()}, Связей: {G.number_of_edges()}',
        fontsize=16,
        fontweight='bold',
        pad=25
    )

    # Добавляем информацию о графе
    info_text = f"Плотность графа: {nx.density(G):.4f}\n"
    info_text += f"Средняя степень узла: {sum(dict(G.degree()).values()) / G.number_of_nodes():.2f}"

    plt.figtext(
        0.02, 0.02,
        info_text,
        fontsize=10,
        bbox=dict(boxstyle="round,pad=0.5", facecolor="lightgray", alpha=0.7)
    )

    # Убираем оси
    plt.axis('off')

    # Настраиваем layout
    plt.tight_layout(rect=[0, 0.03, 0.85, 0.97])

    print("✓ Визуализация завершена!")
    return fig, ax


# ===================== 4. АНАЛИЗ ГРАФА =====================

def analyze_graph(G, node_types):
    """
    Анализирует структуру графа и выводит статистику
    """
    print("\n" + "=" * 60)
    print("АНАЛИЗ ГРАФА")
    print("=" * 60)

    if G.number_of_nodes() == 0:
        print("✗ Граф пустой, анализ невозможен")
        return None, None

    # 1. Основная статистика
    print(f"\n📊 ОСНОВНАЯ СТАТИСТИКА:")
    print(f"  • Узлов всего: {G.number_of_nodes()}")
    print(f"  • Связей всего: {G.number_of_edges()}")
    print(f"  • Плотность графа: {nx.density(G):.4f}")

    # 2. Статистика по типам узлов
    print(f"\n🎨 УЗЛОВ ПО ТИПАМ:")
    type_counts = {}
    type_degrees = {}

    for node, node_type in node_types.items():
        type_counts[node_type] = type_counts.get(node_type, 0) + 1
        degree = G.degree(node)
        if node_type not in type_degrees:
            type_degrees[node_type] = []
        type_degrees[node_type].append(degree)

    for node_type, count in type_counts.items():
        avg_degree = np.mean(type_degrees[node_type]) if node_type in type_degrees else 0
        percentage = count / G.number_of_nodes() * 100
        print(f"  • {node_type}:")
        print(f"      Количество: {count} ({percentage:.1f}%)")
        print(f"      Среднее связей: {avg_degree:.2f}")

    # 3. Наиболее связанные узлы
    print(f"\n🔗 ТОП-10 НАИБОЛЕЕ СВЯЗАННЫХ УЗЛОВ:")
    degree_dict = dict(G.degree())
    sorted_nodes = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)[:10]

    for i, (node, degree) in enumerate(sorted_nodes, 1):
        node_type = node_types.get(node, 'Unknown')
        node_value = node.split(": ", 1)[1] if ": " in node else node
        print(f"  {i:2d}. {node_value[:35]:35s}")
        print(f"       Тип: {node_type}, Связей: {degree}")

    # 4. Поиск ключевых связующих узлов (хабов)
    print(f"\n⭐ КЛЮЧЕВЫЕ СВЯЗУЮЩИЕ УЗЛЫ (ХАБЫ):")

    hub_candidates = []
    for node in G.nodes():
        neighbors = list(G.neighbors(node))
        if len(neighbors) >= 3:  # Узлы с достаточным количеством связей
            neighbor_types = set()
            for neighbor in neighbors:
                neighbor_type = node_types.get(neighbor, 'Unknown')
                neighbor_types.add(neighbor_type)

            if len(neighbor_types) >= 2:  # Соединяют хотя бы 2 разных типа
                hub_candidates.append((node, len(neighbors), len(neighbor_types)))

    # Сортируем по количеству связей
    hub_candidates.sort(key=lambda x: x[1], reverse=True)

    for i, (node, num_connections, num_types) in enumerate(hub_candidates[:5], 1):
        node_value = node.split(": ", 1)[1] if ": " in node else node
        node_type = node_types.get(node, 'Unknown')
        print(f"  {i}. {node_value[:35]:35s}")
        print(f"       Тип: {node_type}, Связей: {num_connections}, Типов соседей: {num_types}")

    # 5. Компоненты связности
    print(f"\n🔗 КОМПОНЕНТЫ СВЯЗНОСТИ:")
    components = list(nx.connected_components(G))
    print(f"  • Всего компонент связности: {len(components)}")

    if len(components) > 1:
        print(f"  • Размеры компонент (отсортировано по убыванию):")
        sorted_components = sorted(components, key=len, reverse=True)
        for i, comp in enumerate(sorted_components[:5], 1):
            print(f"    {i}. {len(comp)} узлов ({len(comp) / G.number_of_nodes() * 100:.1f}%)")

    # 6. Диаметр самой большой компоненты
    if components:
        largest_component = max(components, key=len)
        if len(largest_component) > 1:
            subgraph = G.subgraph(largest_component)
            if nx.is_connected(subgraph):
                try:
                    diameter = nx.diameter(subgraph)
                    print(f"  • Диаметр самой большой компоненты: {diameter}")
                except:
                    print(f"  • Диаметр: невозможно вычислить")

    return degree_dict, components


# ===================== 5. ДОПОЛНИТЕЛЬНАЯ ВИЗУАЛИЗАЦИЯ =====================

def create_additional_visualizations(G, node_types, node_colors):
    """
    Создает дополнительные визуализации графа
    """
    print("\n" + "=" * 60)
    print("ДОПОЛНИТЕЛЬНЫЕ ВИЗУАЛИЗАЦИИ")
    print("=" * 60)

    if G.number_of_nodes() == 0:
        print("✗ Граф пустой, визуализация невозможна")
        return None

    print("⏳ Создание дополнительных визуализаций...")

    # Создаем фигуру с несколькими графиками
    fig, axes = plt.subplots(2, 2, figsize=(16, 14))

    # 1. Гистограмма распределения связей
    degrees = [G.degree(n) for n in G.nodes()]
    axes[0, 0].hist(degrees, bins=20, color='skyblue', edgecolor='black', alpha=0.7)
    axes[0, 0].set_title('Распределение количества связей у узлов', fontsize=12, fontweight='bold')
    axes[0, 0].set_xlabel('Количество связей')
    axes[0, 0].set_ylabel('Количество узлов')
    axes[0, 0].grid(True, alpha=0.3)
    axes[0, 0].axvline(x=np.mean(degrees), color='red', linestyle='--', label=f'Среднее: {np.mean(degrees):.2f}')
    axes[0, 0].legend()

    # 2. Количество узлов по типам
    type_counts = {}
    for node, node_type in node_types.items():
        type_counts[node_type] = type_counts.get(node_type, 0) + 1

    types = list(type_counts.keys())
    counts = list(type_counts.values())
    colors = [node_colors.get(t, '#808080') for t in types]

    bars = axes[0, 1].bar(types, counts, color=colors, alpha=0.8, edgecolor='black')
    axes[0, 1].set_title('Количество узлов по типам', fontsize=12, fontweight='bold')
    axes[0, 1].set_ylabel('Количество узлов')
    axes[0, 1].tick_params(axis='x', rotation=45)

    # Добавляем значения на столбцы
    for bar, count in zip(bars, counts):
        height = bar.get_height()
        axes[0, 1].text(bar.get_x() + bar.get_width() / 2., height + 0.1,
                        f'{count}', ha='center', va='bottom', fontsize=10)

    # 3. Связи по типам (в среднем на узел)
    avg_connections = {}
    for node_type in set(node_types.values()):
        nodes_of_type = [n for n in G.nodes() if node_types.get(n) == node_type]
        if nodes_of_type:
            total_connections = sum(G.degree(n) for n in nodes_of_type)
            avg_connections[node_type] = total_connections / len(nodes_of_type)

    types_avg = list(avg_connections.keys())
    avgs = list(avg_connections.values())
    colors_avg = [node_colors.get(t, '#808080') for t in types_avg]

    bars2 = axes[1, 0].bar(types_avg, avgs, color=colors_avg, alpha=0.8, edgecolor='black')
    axes[1, 0].set_title('Среднее количество связей по типам узлов', fontsize=12, fontweight='bold')
    axes[1, 0].set_ylabel('Среднее число связей')
    axes[1, 0].tick_params(axis='x', rotation=45)
    overall_avg = sum(avgs) / len(avgs) if avgs else 0
    axes[1, 0].axhline(y=overall_avg, color='red', linestyle='--', alpha=0.7, label=f'Общее среднее: {overall_avg:.2f}')
    axes[1, 0].legend()

    # Добавляем значения на столбцы
    for bar, avg in zip(bars2, avgs):
        height = bar.get_height()
        axes[1, 0].text(bar.get_x() + bar.get_width() / 2., height + 0.05,
                        f'{avg:.2f}', ha='center', va='bottom', fontsize=9)

    # 4. График самых связанных узлов
    degree_dict = dict(G.degree())
    top_nodes = sorted(degree_dict.items(), key=lambda x: x[1], reverse=True)[:8]
    top_node_names = []
    for node, _ in top_nodes:
        node_value = node.split(": ", 1)[1] if ": " in node else node
        if len(node_value) > 20:
            top_node_names.append(node_value[:18] + "...")
        else:
            top_node_names.append(node_value)

    top_node_degrees = [n[1] for n in top_nodes]
    top_node_colors = [node_colors.get(node_types.get(n[0], 'Unknown'), '#808080') for n in top_nodes]

    y_pos = range(len(top_node_names))
    bars3 = axes[1, 1].barh(y_pos, top_node_degrees, color=top_node_colors, alpha=0.8, edgecolor='black')
    axes[1, 1].set_yticks(y_pos)
    axes[1, 1].set_yticklabels(top_node_names)
    axes[1, 1].invert_yaxis()  # Самый связанный сверху
    axes[1, 1].set_title('Наиболее связанные узлы', fontsize=12, fontweight='bold')
    axes[1, 1].set_xlabel('Количество связей')

    # Добавляем значения на столбцы
    for bar, degree in zip(bars3, top_node_degrees):
        width = bar.get_width()
        axes[1, 1].text(width + 0.1, bar.get_y() + bar.get_height() / 2.,
                        f'{degree}', ha='left', va='center', fontsize=10)

    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.suptitle('Аналитическая панель графа связей', fontsize=16, fontweight='bold')

    print("✓ Дополнительные визуализации созданы!")
    return fig


# ===================== 6. СОХРАНЕНИЕ РЕЗУЛЬТАТОВ =====================

def save_results(G, node_types, df_graph, degree_dict, components):
    """
    Сохраняет результаты анализа
    """
    print("\n" + "=" * 60)
    print("СОХРАНЕНИЕ РЕЗУЛЬТАТОВ")
    print("=" * 60)

    # Создаем директорию для результатов, если её нет
    output_dir = r"C:\Users\Sasha Bodybuilder\Desktop\Orcestra\Результаты_Анализа"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"✓ Создана директория: {output_dir}")

    # Создаем DataFrame с узлами и их свойствами
    print("⏳ Сбор данных об узлах...")
    nodes_data = []
    for node in G.nodes():
        node_type = node_types.get(node, 'Unknown')
        degree = G.degree(node)
        centrality = degree_dict.get(node, 0) if degree_dict else 0

        # Получаем соседей
        neighbors = list(G.neighbors(node))

        # Определяем типы соседей
        neighbor_types = {}
        for neighbor in neighbors:
            n_type = node_types.get(neighbor, 'Unknown')
            neighbor_types[n_type] = neighbor_types.get(n_type, 0) + 1

        # Находим компоненту
        component_id = -1
        for i, comp in enumerate(components):
            if node in comp:
                component_id = i
                break

        # Разделяем имя узла на тип и значение
        if ": " in node:
            node_prefix, node_value = node.split(": ", 1)
        else:
            node_prefix, node_value = node, node

        nodes_data.append({
            'ID_Узла': node,
            'Тип_Узла': node_type,
            'Значение_Узла': node_value,
            'Количество_Связей': degree,
            'Центральность': centrality,
            'ID_Компоненты': component_id,
            'Размер_Компоненты': len(components[component_id]) if component_id != -1 else 0,
            'Соседи_Всего': len(neighbors),
            'Соседи_по_Типам': str(neighbor_types)
        })

    nodes_df = pd.DataFrame(nodes_data)

    # Сохраняем в Excel
    output_path = os.path.join(output_dir, "граф_анализ.xlsx")

    print(f"⏳ Сохранение в Excel файл: {output_path}")

    try:
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # 1. Узлы графа
            nodes_df.to_excel(writer, sheet_name='Узлы_графа', index=False)

            # 2. Связи графа
            edges_data = []
            for edge in G.edges(data=True):
                node1_type = node_types.get(edge[0], 'Unknown')
                node2_type = node_types.get(edge[1], 'Unknown')

                # Получаем значения узлов (без префикса типа)
                node1_value = edge[0].split(": ", 1)[1] if ": " in edge[0] else edge[0]
                node2_value = edge[1].split(": ", 1)[1] if ": " in edge[1] else edge[1]

                edges_data.append({
                    'Узел_1': edge[0],
                    'Тип_Узла_1': node1_type,
                    'Значение_Узла_1': node1_value,
                    'Узел_2': edge[1],
                    'Тип_Узла_2': node2_type,
                    'Значение_Узла_2': node2_value,
                    'Тип_Связи': f"{node1_type} ↔ {node2_type}"
                })

            edges_df = pd.DataFrame(edges_data)
            edges_df.to_excel(writer, sheet_name='Связи_графа', index=False)

            # 3. Статистика по типам
            type_stats = []
            for node_type in set(node_types.values()):
                nodes_of_type = [n for n in G.nodes() if node_types.get(n) == node_type]
                count = len(nodes_of_type)
                if count > 0:
                    avg_degree = sum(G.degree(n) for n in nodes_of_type) / count
                    type_stats.append({
                        'Тип_Узла': node_type,
                        'Количество': count,
                        'Процент': count / G.number_of_nodes() * 100,
                        'Средняя_Связей': avg_degree
                    })

            stats_df = pd.DataFrame(type_stats)
            stats_df.to_excel(writer, sheet_name='Статистика_по_Типам', index=False)

            # 4. Исходные данные
            df_graph.to_excel(writer, sheet_name='Исходные_данные', index=False)

            # 5. Топ узлов
            top_nodes_df = nodes_df.nlargest(20, 'Количество_Связей')
            top_nodes_df.to_excel(writer, sheet_name='Топ_Узлов', index=False)

        print(f"✓ Результаты сохранены в Excel файл: {output_path}")

        # Сохраняем граф в формате GraphML
        graphml_path = os.path.join(output_dir, "граф_связей.graphml")
        nx.write_graphml(G, graphml_path)
        print(f"✓ Граф сохранен в GraphML: {graphml_path}")

        # Сохраняем изображение графа
        img_path = os.path.join(output_dir, "визуализация_графа.png")
        plt.savefig(img_path, dpi=300, bbox_inches='tight')
        print(f"✓ Изображение графа сохранено: {img_path}")

        return output_path

    except Exception as e:
        print(f"✗ Ошибка при сохранении: {str(e)}")
        return None


# ===================== 7. ОСНОВНОЙ СКРИПТ =====================

def main():
    """
    Основная функция для выполнения всего анализа
    """
    print("=" * 70)
    print("ПОСТРОЕНИЕ И АНАЛИЗ ГРАФА СВЯЗЕЙ ПАРАМЕТРОВ ПРОЕКТОВ")
    print("=" * 70)

    # Полный путь к файлу
    file_path = r"C:\Users\Sasha Bodybuilder\Desktop\Orcestra\DATA.xlsx"

    print(f"📁 Исходный файл: {file_path}")

    # 1. Загрузка данных
    df_graph = load_and_prepare_data(file_path)
    if df_graph is None:
        print("\n✗ Не удалось загрузить данные. Проверьте файл и структуру данных.")
        return

    # 2. Построение графа
    G, node_types, node_colors = build_graph(df_graph)

    if G.number_of_nodes() == 0:
        print("\n✗ Граф не содержит узлов. Проверьте, что в данных есть заполненные поля.")
        return

    # 3. Анализ графа
    degree_dict, components = analyze_graph(G, node_types)

    # 4. Основная визуализация графа
    fig_main, ax_main = visualize_graph(G, node_types, node_colors)

    # 5. Дополнительные визуализации
    fig_analysis = create_additional_visualizations(G, node_types, node_colors)

    # 6. Сохранение результатов
    save_results(G, node_types, df_graph, degree_dict, components)

    # 7. Информация о завершении
    print("\n" + "=" * 70)
    print("АНАЛИЗ ЗАВЕРШЕН УСПЕШНО!")
    print("=" * 70)
    print("\n📊 ОСНОВНЫЕ РЕЗУЛЬТАТЫ:")
    print(f"  • Узлов в графе: {G.number_of_nodes()}")
    print(f"  • Связей в графе: {G.number_of_edges()}")
    print(f"  • Типов узлов: {len(set(node_types.values()))}")
    print(f"  • Компонент связности: {len(components)}")

    if components:
        largest = max(components, key=len)
        print(f"  • Самая большая компонента: {len(largest)} узлов ({len(largest) / G.number_of_nodes() * 100:.1f}%)")

    print("\n💾 СОХРАНЕННЫЕ ФАЙЛЫ:")
    print(f"  • C:\\Users\\Sasha Bodybuilder\\Desktop\\Orcestra\\Результаты_Анализа\\")
    print("      - граф_анализ.xlsx (полный анализ в Excel)")
    print("      - граф_связей.graphml (граф для других программ)")
    print("      - визуализация_графа.png (изображение графа)")

    print("\n🎨 ЛЕГЕНДА ЦВЕТОВ:")
    for node_type, color in node_colors.items():
        count = sum(1 for n_type in node_types.values() if n_type == node_type)
        print(f"  • {node_type}: {color} ({count} узлов)")

    print("\n✅ Все графики будут показаны в отдельных окнах.")
    print("   Закройте окна графиков для завершения программы.")

    # Показываем все графики
    plt.show()


# ===================== ЗАПУСК СКРИПТА =====================

if __name__ == "__main__":
    # Проверка наличия необходимых библиотек
    try:
        import pandas as pd
        import networkx as nx
        import matplotlib.pyplot as plt

        print("✓ Все необходимые библиотеки загружены успешно")
    except ImportError as e:
        print(f"✗ Ошибка: Не удалось импортировать библиотеку: {e}")
        print("\nУстановите необходимые библиотеки:")
        print("  pip install pandas networkx matplotlib openpyxl")
        exit(1)

    # Запуск основного скрипта
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Программа прервана пользователем")
    except Exception as e:
        print(f"\n✗ Произошла ошибка: {str(e)}")
        import traceback

        print(traceback.format_exc())