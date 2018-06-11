import { parseString } from 'xml2js';
import { promisify} from 'util';

export default promisify(parseString);
