/**
 * Poets to draw the poem slot from. PoetryDB carries the public domain canon,
 * which is exactly what Bradbury names: "go back and read Shakespeare, read
 * Alexander Pope, read Robert Frost."
 *
 * `year` is a rough floruit, shown as context rather than as a precise date.
 * `subjects` steer field tagging for poets whose work sits in a clear register.
 */
export interface Poet {
  name: string
  year?: number
  subjects: string[]
}

export const POETS: Poet[] = [
  { name: 'William Shakespeare', year: 1609, subjects: ['drama', 'literature'] },
  { name: 'Alexander Pope', year: 1711, subjects: ['satire', 'philosophy'] },
  { name: 'Robert Frost', year: 1916, subjects: ['nature', 'landscape'] },
  { name: 'Emily Dickinson', year: 1890, subjects: ['mind', 'nature'] },
  { name: 'Walt Whitman', year: 1855, subjects: ['nature', 'society'] },
  { name: 'John Keats', year: 1819, subjects: ['art', 'aesthetics'] },
  { name: 'William Blake', year: 1794, subjects: ['religion', 'myth'] },
  { name: 'William Wordsworth', year: 1798, subjects: ['nature', 'landscape'] },
  { name: 'Samuel Taylor Coleridge', year: 1798, subjects: ['nature', 'myth'] },
  { name: 'Percy Bysshe Shelley', year: 1820, subjects: ['politics', 'philosophy'] },
  { name: 'Lord Byron', year: 1818, subjects: ['travel', 'society'] },
  { name: 'John Donne', year: 1633, subjects: ['religion', 'metaphysics'] },
  { name: 'George Herbert', year: 1633, subjects: ['religion', 'theology'] },
  { name: 'John Milton', year: 1667, subjects: ['religion', 'politics'] },
  { name: 'Andrew Marvell', year: 1681, subjects: ['nature', 'politics'] },
  { name: 'Robert Herrick', year: 1648, subjects: ['nature', 'season'] },
  { name: 'Christina Rossetti', year: 1862, subjects: ['religion', 'nature'] },
  { name: 'Dante Gabriel Rossetti', year: 1870, subjects: ['art', 'myth'] },
  { name: 'Elizabeth Barrett Browning', year: 1850, subjects: ['society', 'literature'] },
  { name: 'Robert Browning', year: 1855, subjects: ['psychology', 'mind'] },
  { name: 'Alfred Lord Tennyson', year: 1850, subjects: ['myth', 'history'] },
  { name: 'Matthew Arnold', year: 1867, subjects: ['philosophy', 'criticism'] },
  { name: 'Gerard Manley Hopkins', year: 1877, subjects: ['religion', 'nature'] },
  { name: 'Thomas Hardy', year: 1898, subjects: ['nature', 'society'] },
  { name: 'A. E. Housman', year: 1896, subjects: ['landscape', 'mortality'] },
  { name: 'William Butler Yeats', year: 1919, subjects: ['myth', 'politics'] },
  { name: 'Edgar Allan Poe', year: 1845, subjects: ['mind', 'psychology'] },
  { name: 'Henry Wadsworth Longfellow', year: 1855, subjects: ['history', 'myth'] },
  { name: 'Ralph Waldo Emerson', year: 1847, subjects: ['philosophy', 'nature'] },
  { name: 'Oliver Wendell Holmes', year: 1858, subjects: ['society', 'medicine'] },
  { name: 'Paul Laurence Dunbar', year: 1896, subjects: ['society', 'music'] },
  { name: 'Sara Teasdale', year: 1915, subjects: ['nature', 'emotion'] },
  { name: 'Rupert Brooke', year: 1914, subjects: ['war', 'politics'] },
  { name: 'Wilfred Owen', year: 1918, subjects: ['war', 'politics'] },
  { name: 'Katherine Mansfield', year: 1915, subjects: ['nature', 'emotion'] },
  { name: 'Anne Bradstreet', year: 1650, subjects: ['religion', 'society'] },
  { name: 'Phillis Wheatley', year: 1773, subjects: ['religion', 'society'] },
  { name: 'Edmund Spenser', year: 1590, subjects: ['myth', 'literature'] },
  { name: 'Sir Philip Sidney', year: 1591, subjects: ['literature', 'rhetoric'] },
  { name: 'Ben Jonson', year: 1616, subjects: ['drama', 'satire'] },
  { name: 'Thomas Gray', year: 1751, subjects: ['landscape', 'mortality'] },
  { name: 'William Cowper', year: 1785, subjects: ['nature', 'religion'] },
  { name: 'Robert Burns', year: 1786, subjects: ['nature', 'society'] },
  { name: 'Jonathan Swift', year: 1730, subjects: ['satire', 'politics'] },
  { name: 'Algernon Charles Swinburne', year: 1866, subjects: ['myth', 'art'] },
  { name: 'Lewis Carroll', year: 1871, subjects: ['logic', 'literature'] },
  { name: 'Edward Lear', year: 1871, subjects: ['literature', 'art'] },
  { name: 'Emma Lazarus', year: 1883, subjects: ['politics', 'society'] },
  { name: 'Stephen Crane', year: 1895, subjects: ['war', 'society'] },
  { name: 'Ernest Dowson', year: 1896, subjects: ['emotion', 'art'] },
]
